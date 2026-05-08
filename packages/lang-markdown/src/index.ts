// @kindly-note/lang-markdown — the Markdown (CommonMark) language definition.
//
// spec §1.5 row `@kindly-note/lang-markdown`:
//   - default export: a `LanguageDefinition<MarkdownExtensionPoints>` (deep-frozen at module init).
//   - named export: `MarkdownExtensionPoints` (type) — the `extensible` shape.
//   - aliases: `md`, `markdown`, `mkdown`, `mkd`.
//   - depends on: @kindly-note/core, @kindly-note/lang-helpers.
//
// Spec §0 architectural shifts validated by this package:
//   #1 Languages-as-values — the export is a typed value, not a function that
//      mutates a shared `hljs` argument.
//   #2 Compile-at-register-time, immutable — `defineLanguage()` deep-freezes
//      the definition at module init; the matcher in @kindly-note/core
//      compiles a fresh CompiledLanguage at register time.
//   #5 The keystone `extendLanguage()` API: this package publishes a typed
//      `extensible` surface (`MarkdownExtensionPoints`) so the future
//      `@kindly-note/lang-markdown-gfm` (cohort 7+) can add GFM features
//      (tables, task lists, autolinks, strikethrough) WITHOUT mutating
//      lang-markdown. spec §13.2 dialect strategy.
//
// Reference shape (NOT byte-copied) is upstream's `src/languages/markdown.js`.
// We modernise: typed Mode shape, frozen contains array, scope (not className),
// no `hljs.` runtime injection, multi-capture per-group scope emit, AND a
// fenced-code-block subLanguage variant set so embedded code highlights via
// downstream language packages (the v0 acceptance proof point — spec §1.5
// acceptance gate #5).
//
// SCOPE BOUNDARY (spec §1.5 + §13):
//   - This package is the TOKENISER ONLY. Semantic-HTML rendering (`<h1>`,
//     `<strong>`, `<a href>`, etc.) is cohort 7b's `@kindly-note/emitters-markdown`
//     job. Security defaults (URL allowlists, `<script>` escaping, bidi-control
//     normalisation) are likewise emitter-side per spec §13.1.
//   - Attribute-aware emit (`startScopeWithAttrs`) is preliminary v1+ design
//     per spec §13.3; for THIS cohort, we surface url tokens via plain `string`
//     scope and flag attribute needs (e.g. `<a href>`) as an open question
//     for cohort 7b.
//
// CONSTRAINT — sub-language dispatch is static in v0 (matcher.ts:194); we
// enumerate well-known languages as separate fence variants. See modes.ts
// for the full rationale and OPEN-QUESTION block.

import type { LanguageDefinition, Mode } from '@kindly-note/core';
import { defineLanguage } from '@kindly-note/core';
import type { MarkdownExtensionPoints } from './extensions.js';
import {
  BLOCKQUOTE,
  BLOCK_CONTAINS,
  FENCED_CODE,
  HEADER,
  HORIZONTAL_RULE,
  INDENTED_CODE,
  INLINE_CONTAINS,
  LINK,
  LIST,
} from './modes.js';

// Re-export the type so downstream extenders (especially the future
// `@kindly-note/lang-markdown-gfm`) can satisfy
// `extendLanguage<MarkdownExtensionPoints>(markdown, ...)` at the call site.
// spec §1.5 row "named: `MarkdownExtensionPoints` (type)".
export type { MarkdownExtensionPoints } from './extensions.js';

/**
 * Compose the BLOCKQUOTE mode with INLINE_CONTAINS as its contains. We do this
 * at the language-composition stage rather than at the module-init stage of
 * `modes.ts` because `INLINE_CONTAINS` is itself an array of frozen Modes;
 * spreading it into BLOCKQUOTE.contains here keeps the import order acyclic
 * and lets downstream extenders (via `extendLanguage`) replace either piece
 * cleanly without wrestling with module-init cycles.
 */
const BLOCKQUOTE_WITH_INLINE: Mode = {
  ...BLOCKQUOTE,
  contains: INLINE_CONTAINS,
};

/**
 * The Markdown LanguageDefinition. spec §0 shift #1: a deep-frozen value, not
 * a factory function. spec §1.5 row aliases: `md` (canonical-lowercase),
 * `markdown`, `mkdown`, `mkd`. The `extensible` field publishes the typed
 * extension surface lang-markdown-gfm (and future MDX extenders) consume per
 * spec §8.2 THE KEYSTONE / §13.2 dialect strategy.
 *
 * Order of `contains` follows BLOCK_CONTAINS but with BLOCKQUOTE swapped for
 * its inline-aware variant; the matcher's leftmost-then-first-alternative
 * regex semantics give earlier alternatives priority when two modes' begin
 * patterns match the same position. Inline modes (BOLD/ITALIC/INLINE_CODE/LINK)
 * appear at the top-level too so they fire on paragraph text outside of any
 * block container.
 *
 * `disableAutodetect: false` (the default) — spec §1.5 acceptance gate #12:
 * markdown should be in the auto-detect candidate set. Relevance scoring is
 * upstream's call.
 */
const markdown: LanguageDefinition<MarkdownExtensionPoints> =
  defineLanguage<MarkdownExtensionPoints>({
    name: 'Markdown',
    aliases: ['md', 'markdown', 'mkdown', 'mkd'],
    contains: [
      // Block-level modes first. HEADER + HORIZONTAL_RULE + FENCED_CODE are
      // anchored on `^` so they only match at line-start; the matcher's union
      // tries them in order. INDENTED_CODE is anchored on `^` too. LIST is
      // anchored on `^[ \t]*([-*+]|\d+\.)`.
      HEADER,
      HORIZONTAL_RULE,
      FENCED_CODE,
      INDENTED_CODE,
      // Blockquote with inline contains so `> **bold**` highlights the bold.
      BLOCKQUOTE_WITH_INLINE,
      LIST,
      // Inline modes — fire at the top level for paragraph text.
      ...INLINE_CONTAINS,
    ],
    // spec §8.2: the typed extension surface. `extendLanguage` consumes this
    // shape; `extendPoints[K]` receives `current: TExt[K]` and returns the
    // new value (never mutates the parent). Per spec §13.2: the GFM
    // extension lands as `extendLanguage(markdown, { extendPoints: { ... } })`
    // in a SEPARATE later package (`@kindly-note/lang-markdown-gfm`).
    extensible: {
      INLINE_CONTAINS,
      BLOCK_CONTAINS,
      LINK_MODE: LINK,
    },
  });

export default markdown;
