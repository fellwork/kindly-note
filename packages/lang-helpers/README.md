# @kindly-note/lang-helpers

Tree-shakable Mode helpers and regex constants for kindly-note language packages.

This package is the universal mode-helper home for every `@kindly-note/lang-*`
package. Every export is a named value (no default), every helper produces a
deep-frozen `Mode`, and importing the module has zero side effects
(`package.json#sideEffects: false`). Languages are values, not registrations:
helpers compose into language definitions, and bundlers drop the helpers your
language never references.

The runtime dependency on `@kindly-note/core` is types-only (`import type`); no
runtime edge exists between this package and the engine.

## Install

```sh
bun add @kindly-note/lang-helpers @kindly-note/core
# or
npm install @kindly-note/lang-helpers @kindly-note/core
```

## Usage

Helpers compose directly into a `defineLanguage()` call:

```ts
import { defineLanguage } from '@kindly-note/core';
import {
  cLineComment,
  cBlockComment,
  cNumberMode,
  quoteString,
  IDENT_RE,
} from '@kindly-note/lang-helpers';

export default defineLanguage({
  name: 'mini-c',
  aliases: ['minic'],
  keywords: ['if', 'else', 'while', 'return'],
  contains: [
    cLineComment,
    cBlockComment,
    cNumberMode,
    quoteString,
    {
      scope: 'title.function',
      begin: IDENT_RE,
      relevance: 0,
    },
  ],
});
```

Because every helper is a frozen value, two highlighters can share `cNumberMode`
without corrupting each other's compilation state — the matcher in
`@kindly-note/core` compiles modes by reference and never mutates them.

## Helpers

Alphabetical. All helpers return frozen `Mode` objects (or, for factories, a
fresh frozen `Mode` per call).

- `apostropheString` — `'…'` single-quoted string with backslash escapes;
  newline is illegal.
- `backslashEscape` — escape sub-mode (`\\` followed by any character) used
  inside string modes. Relevance 0.
- `binaryNumberMode` — binary literal `0b1010`. Relevance 0.
- `cBlockComment` — `/* … */` block comment (C / C++ / JS / TS / Java).
- `cLineComment` — `// …` line comment to end-of-line (C / C++ / JS / TS / Rust).
- `cNumberMode` — C-style number: hex (`0xFF`), decimal, exponent (`1e6`).
  Relevance 0.
- `comment(begin, end, modeOptions?)` — canonical comment-mode factory.
  Returns a fresh frozen `Mode` with `scope: 'comment'` and built-in `doctag`
  (TODO/FIXME/NOTE/BUG/OPTIMIZE/HACK/XXX) plus English-prose detection. Caller
  `contains` is appended; caller `scope` / `begin` / `end` overrides win.
- `endSameAsBegin(mode)` — wrap a `Mode` so its `end` only matches when
  capture-group 1 of `begin` equals capture-group 1 of `end`. Used for heredoc
  and Ruby `%w(…)`-style paired delimiters.
- `hashComment` — `# …` line comment to end-of-line (Python / Ruby / shell).
- `methodGuard` — excludes method names from keyword processing (e.g.
  `arr.length` should not highlight `length` as a keyword). Relevance 0.
- `numberMode` — plain decimal number: `123`, `12.3`. Relevance 0.
- `phrasalWords` — begin-only Mode matching common English filler words; used
  to boost relevance when surrounding text looks like prose.
- `quoteString` — `"…"` double-quoted string with backslash escapes; newline
  is illegal.
- `regexpMode` — JavaScript-style `/pattern/flags` regex literal with a
  nested character-class sub-mode so `/` inside `[...]` does not terminate.
- `shebang(opts?)` — shebang line at start of file (`#!/usr/bin/env node`).
  Pass `{ binary: 'node' }` to anchor on a specific binary; the start-of-file
  constraint lives in the regex (no `on:begin` callback).
- `titleMode` — identifier-shaped title matching `[a-zA-Z]\w*`. Relevance 0.
- `underscoreTitleMode` — title that allows a leading underscore:
  `[a-zA-Z_]\w*`. Relevance 0.

## Regex constants

Regex *source strings* (not `RegExp` instances). The matcher in
`@kindly-note/core` compiles them at compile-time, and string form keeps them
composable with `regex.concat(...)` without paying per-call `new RegExp` cost.

- `BINARY_NUMBER_RE` — `\b(0b[01]+)`.
- `C_NUMBER_RE` — hex / decimal / exponent (`0xFF`, `12.3`, `1e-6`), with an
  optional leading minus capture for upstream parity.
- `IDENT_RE` — identifier: `[a-zA-Z]\w*`.
- `MATCH_NOTHING_RE` — `/\b\B/`, a sentinel regex that never matches.
- `NUMBER_RE` — plain decimal number, no sign or exponent: `\b\d+(\.\d+)?`.
- `RE_STARTERS_RE` — operators / punctuation that may *precede* a regex
  literal in JS-like languages (alternative ordering matters for first-match).
- `UNDERSCORE_IDENT_RE` — identifier including a leading underscore:
  `[a-zA-Z_]\w*`.

## Status

v0, in active development. Public surface is stable per
[`docs/plan/architect-spec.md`](../../docs/plan/architect-spec.md) §1.2; minor
additions (e.g. `hashComment`, `underscoreTitleMode`, `MATCH_NOTHING_RE`,
`shebang()`) are listed under §1.2's "etc." and the worked examples in
§8.2.1 / §8.2.2.

## License

BSD-3-Clause.

---

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
