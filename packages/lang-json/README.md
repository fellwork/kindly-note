# @kindly-note/lang-json

JSON, JSONC, and JSON5 language definition for [kindly-note](../../README.md).
A single deep-frozen `LanguageDefinition` covering all three dialects on one
unified lexical surface — property names, strings, numbers, literals,
punctuation, and (for JSONC / JSON5) line and block comments.

Implements row `@kindly-note/lang-json` of the architectural spec
(`docs/plan/architect-spec.md` §1.2). Validates spec §0 shifts #1 (languages
are values) and #2 (compile-at-register-time, immutable).

## Install

```sh
bun add @kindly-note/core @kindly-note/lang-json
```

The package's `dependencies` already pull in `@kindly-note/lang-helpers` and
`@kindly-note/lang-pack-ecmascript` transitively — you only need to install
`@kindly-note/core` (the engine) alongside it.

## Usage

```ts
import { createHighlighter } from '@kindly-note/core';
import json from '@kindly-note/lang-json';

const hl = createHighlighter({ languages: [json] });
const result = hl.highlight('{"a":1}', { language: 'json' });
console.log(result.value);
```

The default export is a `LanguageDefinition` value, not a factory function —
no global registry is mutated on import, and bundlers tree-shake unused
languages by import graph alone (spec §0 shift #1).

### Example output spans

With the default `htmlEmitter` (class prefix `kn-`), the input `{"a":1}`
renders as:

```html
<span class="kn-punctuation">{</span><span class="kn-attr">"a"</span><span class="kn-punctuation">:</span><span class="kn-number">1</span><span class="kn-punctuation">}</span>
```

Token-type coverage:

| scope          | matches                                          |
|----------------|--------------------------------------------------|
| `attr`         | property names — `"key":` (lookahead-anchored)   |
| `string`       | string values (double- and single-quoted for JSON5) |
| `number`       | `42`, `-3`, `2.5`, `1e6`, `0xFF` (extended)      |
| `literal`      | `true`, `false`, `null`                          |
| `punctuation`  | `{` `}` `[` `]` `,` `:`                          |
| `comment`      | `// line` and `/* block */` (JSONC / JSON5 only) |

Whitespace between tokens (` `, `\n`, `\t`) is preserved as raw text — never
wrapped in a span — so reformatted output is byte-identical to the input
when stripped of HTML tags.

## Aliases

`json`, `jsonc`, and `json5` all resolve to the same registered handle:

```ts
const hl = createHighlighter({ languages: [json] });

hl.getLanguage('json');   // → handle
hl.getLanguage('jsonc');  // → same handle
hl.getLanguage('json5');  // → same handle
hl.getLanguage('JSONC');  // → same handle (case-insensitive)
```

The canonical name is `JSON`, returned by `listLanguages()` and on
`HighlightResult.language`. Round-1 user lock: byte-for-byte fixture parity
with upstream highlight.js is **not** a goal — structural correctness
(correct scope on each lexeme) is.

The `illegal: '\\S'` rule is strict: any non-whitespace lexeme outside the
recognised modes fires `IllegalSyntaxError`, surfacing as
`result.illegal: true`. A future `@kindly-note/lang-json-strict` may tighten
the surface to RFC 8259 (no comments, double-quoted strings only).

## Status

Cohort 3b — shipped alongside `@kindly-note/lang-pack-ecmascript`. 18 tests
across frozen-definition, end-to-end highlight, alias resolution, nested
objects/arrays, whitespace preservation, compilation immutability, and
sanity (illegal handling, empty containers, number variants). See
`docs/plan/build-manifest-c3b.md` for the full verification log.

## License

MIT. See [LICENSE](../../LICENSE).

<!--
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
-->
