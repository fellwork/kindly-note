# @kindly-note/auto-detect

Heuristic language auto-detection for kindly-note: scores every registered
language against a code sample, returns the best match plus runner-up, and
breaks ties via the `supersetOf` relationship declared on each language.

A pure factory over a `Highlighter` handle. The detector itself is stateless:
every `detect()` call re-reads the highlighter's current registry, so languages
registered between detector construction and a `detect()` call are picked up
automatically. Mirrors upstream highlight.js's `highlightAuto` algorithm
one-to-one, plus a `preferLanguage` knob and explicit no-fallback semantics.

## Install

```sh
npm install @kindly-note/auto-detect @kindly-note/core
bun add @kindly-note/auto-detect @kindly-note/core
pnpm add @kindly-note/auto-detect @kindly-note/core
```

## Usage

```ts
import { createHighlighter } from '@kindly-note/core';
import { createAutoDetector } from '@kindly-note/auto-detect';
import javascript from '@kindly-note/lang-javascript';
import typescript from '@kindly-note/lang-typescript';

const hl = createHighlighter({ languages: [javascript, typescript] });
const ad = createAutoDetector(hl);

const r = ad.detect('console.log(1)');
console.log(r.language, r.secondBest);
// → 'JavaScript' 'TypeScript'

r.value;     // highlighted output value from the winning language
r.relevance; // numeric relevance score of the best match (0 when no match)
```

When the top score is `0` (no language matched), `language` is `undefined` and
`relevance` is `0`. kindly-note does NOT ship a built-in `plaintext` fallback
(per architect-spec §1.4) — bring your own plaintext language and pass it via
`subset` if you want a guaranteed-non-undefined return.

## Options

`detect(code, opts?)` accepts:

- `subset?: readonly string[]` — only consider these registered language names
  (canonical or alias). Names that don't resolve are silently dropped. Mirrors
  upstream's `languageSubset` parameter.
- `includeDisabled?: boolean` — by default, languages with
  `disableAutodetect: true` are excluded; set this to `true` to include them.
- `preferLanguage?: string` — on a relevance tie, prefer this canonical name.
  Useful for editor "stickiness" (last selected dialect) and for resolving
  close-relative ties more aggressively than `supersetOf`. kindly-note
  extension over the upstream algorithm.

## Tie-breaking

Two-stage comparator:

1. **Higher `relevance` wins.** Each candidate is scored by running
   `hl.highlight(code, { language, ignoreIllegals: false })` and reading
   `result.relevance`. Illegal-rule hits drop the score to `0`.
2. **On a tie**, in priority order:
   - If `preferLanguage` is set and one candidate matches it, that one wins.
   - Otherwise, the language whose `supersetOf` points at the other sorts
     **after** — i.e. the parent language wins. Concretely: when JavaScript and
     TypeScript tie on relevance for the input `console.log(1)`, TypeScript
     declares `supersetOf: 'javascript'`, so JavaScript wins. Mirrors upstream's
     lang-arduino vs lang-cpp tie-break shape.
   - Otherwise, registration order (sort is stable in modern engines).

## API

```ts
export function createAutoDetector(hl: Highlighter): AutoDetector;

export interface AutoDetector {
  detect(code: string, opts?: AutoDetectOptions): AutoDetectResult;
}

export interface AutoDetectOptions {
  readonly subset?: readonly string[];
  readonly includeDisabled?: boolean;
  readonly preferLanguage?: string;
}

export interface AutoDetectResult {
  /** Canonical name of the detected language; undefined if no match. */
  readonly language?: string;
  /** Canonical name of the runner-up; undefined when fewer than two candidates. */
  readonly secondBest?: string;
  /** Highlighted output value from the best language ('' when none). */
  readonly value: string;
  /** Numeric relevance score of the best match (0 when none). */
  readonly relevance: number;
}
```

The returned `AutoDetector` and every `AutoDetectResult` are frozen, so callers
can safely share results across handlers without defensive copies.

`secondBest` is the runner-up's name string only — not a full
`HighlightResult`. If you need the runner-up's rendered value, call
`hl.highlight(code, { language: secondBest })` directly.

## Status

v0, in active development. Public surface is stable per architect-spec
§1.2 row `@kindly-note/auto-detect`. See
[`docs/plan/build-manifest-c5b.md`](../../docs/plan/build-manifest-c5b.md)
for acceptance gates, deferred items (notably `MAX_KEYWORD_HITS` dampening
and the absence of a built-in plaintext fallback), and verification evidence.

## License

BSD-3-Clause.

---

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
