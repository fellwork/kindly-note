# @kindly-note/lang-pack-ecmascript

Shared mode helpers and constant lists for the ECMAScript family: JS, TS,
CoffeeScript, LiveScript, JSON.

This package mirrors upstream's `src/languages/lib/ecmascript.js` — the keyword
list, literal list, built-in / built-in-variable lists, and the canonical
"extended number" Mode that every JS-family language wants. Pure data plus one
factory function. Every export is a named value (no default), every Mode is
deep-frozen, and importing the module has zero side effects
(`package.json#sideEffects: false`). Spec §0 architectural shifts apply:
languages-as-values, helpers produce frozen Modes, never mutate.

The runtime dependency on `@kindly-note/core` is types-only (`import type`); the
dependency on `@kindly-note/lang-helpers` exists only to re-export `IDENT_RE`
from its canonical home.

## Install

```sh
bun add @kindly-note/lang-pack-ecmascript @kindly-note/core
# or
npm install @kindly-note/lang-pack-ecmascript @kindly-note/core
```

## Usage

Import the helpers you need by name and compose them into a `defineLanguage()`
call. Importing as a namespace (`import * as ECMAScript`) is also idiomatic and
matches the worked examples in spec §8.2.1 / §8.2.2.

```ts
import { defineLanguage } from '@kindly-note/core';
import { EXTENDED_NUMBER_MODE, KEYWORDS } from '@kindly-note/lang-pack-ecmascript';

export default defineLanguage({
  name: 'mini-js',
  aliases: ['minijs'],
  keywords: { keyword: KEYWORDS },
  contains: [EXTENDED_NUMBER_MODE],
});
```

`EXTENDED_NUMBER_MODE` is a frozen reference shared across every importer — two
language packs can place it inside their own `contains` arrays without
corrupting each other's compilation state, because the matcher in
`@kindly-note/core` compiles modes by reference and never mutates them.

When you need the same number pattern but with a different scope or relevance,
call the factory:

```ts
import { extendedNumberMode } from '@kindly-note/lang-pack-ecmascript';

const TS_NUMBER = extendedNumberMode({ scope: 'literal', relevance: 1 });
```

## Exports

Alphabetical. All Modes are deep-frozen; all string lists are
`readonly string[]` frozen at module init.

- `BUILT_INS` — composite list of every "built-in" name the engine should treat
  as `built_in` scope: globals (`setTimeout`, `parseInt`, …), constructor types
  (`Object`, `Array`, `Promise`, `Map`, …), and error types (`Error`,
  `TypeError`, …). Mirrors upstream's `BUILT_INS`.
- `BUILT_IN_VARIABLES` — variables that read like keywords but are runtime-bound
  (`this`, `super`, `arguments`, `console`, `window`, `document`, `module`,
  `global`, `localStorage`, `sessionStorage`). Used with the `variable.language`
  scope. Mirrors upstream's `BUILT_IN_VARIABLES`.
- `EXTENDED_NUMBER_MODE` — canonical "ECMAScript family number" `Mode`:
  `scope: 'number'`, `relevance: 0`, matches hex (`0xFF`), decimal,
  fractional (`.5`, `12.3`), exponent (`1e6`, `1.2e-3`), and the special
  literals `NaN` / `±Infinity`. Frozen reference, identity-stable across
  imports.
- `EXTENDED_NUMBER_RE` — the source string of `EXTENDED_NUMBER_MODE.match`.
  Exported separately so callers can compose it with surrounding context via
  `regex.concat(...)` without unwrapping the Mode.
- `IDENT_RE` — JS identifier pattern (`[A-Za-z$_][0-9A-Za-z$_]*`). Re-exported
  from `@kindly-note/lang-helpers` (the canonical owner) as a convenience for
  ECMAScript-family lang packs that already depend on this package.
- `KEYWORDS` — ECMAScript reserved words and contextual keywords (`as`, `in`,
  `of`, `if`, `for`, `function`, `class`, `async`, `await`, `let`, `const`,
  `using`, …). Mirrors upstream's `KEYWORDS`. JSON consumes a narrow subset;
  JS / TS consume the full list.
- `LITERALS` — literal lexemes: `true`, `false`, `null`, `undefined`, `NaN`,
  `Infinity`. JSON narrows to `'true' | 'false' | 'null'`; JS / TS pull the
  full list.
- `extendedNumberMode(overrides?)` — factory returning a fresh deep-frozen
  number `Mode` with caller-supplied overrides merged on top of the
  `EXTENDED_NUMBER_MODE` defaults. Each call returns an independent Mode, safe
  to call in a tight loop.

Every list is plain `readonly string[]`, so consumers can spread into their
own `Keywords` records or append additions without copying:

```ts
keywords: {
  keyword: [...KEYWORDS, 'package'],
  built_in: [...BUILT_INS, ...myExtras],
}
```

## Used by

The ECMAScript helpers feed every JS-family language pack in the workspace:

- [`@kindly-note/lang-json`](../lang-json) — uses `EXTENDED_NUMBER_MODE` (the
  only number form JSON accepts) and a narrowed subset of `LITERALS`.
- [`@kindly-note/lang-javascript`](../lang-javascript) — uses `IDENT_RE`,
  `KEYWORDS`, `LITERALS`, `BUILT_INS`, and `BUILT_IN_VARIABLES` for the JS
  language definition (worked sample: spec §8.2.1).
- [`@kindly-note/lang-typescript`](../lang-typescript) — extends the JS
  language and reuses `IDENT_RE` for decorator and namespace patterns
  (worked sample: spec §8.2.2).

Future ECMAScript-family languages (CoffeeScript, LiveScript, and any
JS-superset added later) are expected to consume the same surface — that is
why this package is split out from `@kindly-note/lang-helpers` rather than
inlined into every dependent (spec §1.2 audit, line ~1520).

## Status

v0, in active development. Public surface is stable per
[`docs/plan/architect-spec.md`](../../docs/plan/architect-spec.md) §1.2 (the
`@kindly-note/lang-pack-ecmascript` row) and the upstream-mapping table in
§9.x. Cohort-3b build manifest:
[`docs/plan/build-manifest-c3b.md`](../../docs/plan/build-manifest-c3b.md).

## License

MIT.

---

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
