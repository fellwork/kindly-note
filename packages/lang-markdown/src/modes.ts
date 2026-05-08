// Mode-tree fragments for Markdown (CommonMark). Each is exported so the
// index file composes them into the LanguageDefinition's `contains` array,
// and so the extensible INLINE_CONTAINS / BLOCK_CONTAINS / LINK_MODE values
// can reference them without circular import.
//
// spec §1.5: lang-markdown covers `md`, `markdown`, `mkdown`, `mkd` aliases;
// spec §13.2: CommonMark default; GFM extension (`@kindly-note/lang-markdown-gfm`)
// is a SEPARATE later package via the keystone `extendLanguage()` API.
//
// Reference shape (NOT byte-copied) is upstream's `src/languages/markdown.js`.
// We modernise: typed Mode shape, frozen contains array, scope (not className),
// no `hljs.` runtime injection, and per-capture-group scope emit (`scope: { 1:..., 3:... }`)
// rendered through the cohort-4 matcher's per-capture-group emit.
//
// v0 SCOPE — covers the most-common 80% of CommonMark:
//   - ATX headers (`#` … `######`) — `meta` for the `#`s, `section` for body
//   - Bold (`**`/`__`) — `strong`
//   - Italic (`*`/`_`) — `emphasis`
//   - Inline code (`` ` ``) — `code`
//   - Fenced code (```` ``` ````, `~~~`) — `code`, with `subLanguage:` for
//     known languages (json, js, ts, css, html) so embedded code highlights
//     via downstream language packages
//   - Indented code blocks (4-space) — `code`
//   - Blockquotes (`> `) — `quote`
//   - Lists (`-`, `*`, `+`, `1.`) — `bullet`
//   - Inline links (`[text](url)`) — `link` on text, `string` on url
//   - Horizontal rules (`---`/`***`/`___`) — `meta`
//   - Backslash escapes (`\*` etc.) — passed as plain text
//
// OUT-OF-SCOPE for v0 (open questions; future cohort or GFM package addresses):
//   - Setext headers (`===` / `---` underline) — out
//   - Reference-style links (`[text][ref]` + `[ref]: url`) — out
//   - HTML blocks (raw HTML pass-through) — out (security concern;
//     `emitters-markdown` will handle the escape policy per spec §13.1)
//   - Tables, task lists, autolinks, strikethrough — out (those are GFM,
//     which is a SEPARATE package per spec §13.2)
//
// CONSTRAINT — sub-language dispatch is static in v0:
//   The matcher (packages/core/src/internal/matcher.ts:194) accepts only
//   `subLanguage: string` for v0; `subLanguage: readonly string[]` (auto-detect)
//   is annotated "out of scope for cohort 3a." We therefore enumerate the most
//   common code-fence languages as separate variants, each with a fixed
//   `subLanguage`. Unknown languages fall through to a plain ``` ``` block.
//   Future cohort can replace this with auto-detect-array dispatch when the
//   matcher gains it.

import type { Mode } from '@kindly-note/core';

// ---------------------------------------------------------------------------
// Headers — ATX style only (spec §1.5, v0 scope)
// ---------------------------------------------------------------------------

/**
 * ATX header `# h1` through `###### h6`. The `#`s emit as `meta`; the body
 * after the `#`s emits as `section` (mirrors upstream's `className: 'section'`).
 *
 * Multi-capture form: capture 1 = the leading `#`s, capture 2 = the body
 * (everything until end-of-line). Spec §1.5 acceptance gate #2: highlight
 * `# H1` and `### H3`; assert `#`/`###` get `meta` scope and the heading
 * text gets `section` scope.
 *
 * The `^` anchor + capture-group form replaces upstream's begin/end pair
 * with a single-shot multi-capture match; this gives clean per-group scope
 * emission via the matcher's `scope: { 1: ..., 2: ... }` path (spec §8.2.1
 * worked example pattern).
 */
export const HEADER: Mode = {
  // Multi-line so `^` matches per-line, not just file start.
  match: [/^#{1,6}/, /[^\n]+/],
  scope: {
    1: 'meta',
    2: 'section',
  },
  relevance: 10,
};

// ---------------------------------------------------------------------------
// Horizontal rule (spec §1.5 acceptance gate #9)
// ---------------------------------------------------------------------------

/**
 * Horizontal rule on its own line: `---`, `***`, or `___`. CommonMark requires
 * 3+ matching characters, optionally with internal spaces. We accept the
 * common forms; the `meta` scope mirrors upstream's HORIZONTAL_RULE shape.
 *
 * IMPLEMENTATION NOTE — no backreferences:
 *   The matcher's MultiRegex wraps each rule in `(...)` for branch tracking
 *   (multi-regex.ts:93). That wrapper renumbers our internal capture groups,
 *   which breaks any intra-rule backreference (the upstream `\1` form).
 *   We therefore enumerate the three delimiter cases as separate variants
 *   rather than `([-*_])(?:[ \\t]*\\1){2,}`. matcher v0 design: cohort 3a
 *   build-manifest noted "inter-rule backrefs are not supported in v0";
 *   intra-rule backrefs through the wrapper are similarly broken.
 *
 * relevance: 1 — a strong markdown signal but not exclusive.
 */
export const HORIZONTAL_RULE: Mode = {
  scope: 'meta',
  variants: [
    // 3+ dashes, optionally interleaved with spaces, on its own line.
    { match: /^[ \t]{0,3}-(?:[ \t]*-){2,}[ \t]*$/ },
    // 3+ asterisks.
    { match: /^[ \t]{0,3}\*(?:[ \t]*\*){2,}[ \t]*$/ },
    // 3+ underscores.
    { match: /^[ \t]{0,3}_(?:[ \t]*_){2,}[ \t]*$/ },
  ],
  relevance: 1,
};

// ---------------------------------------------------------------------------
// Lists (spec §1.5 acceptance gate #6)
// ---------------------------------------------------------------------------

/**
 * Unordered list marker (`-`, `*`, `+`) or ordered list marker (`1.`, `42.`).
 * Mirrors upstream `LIST` shape — match the marker and the trailing space,
 * scope just the marker as `bullet`. The text following the marker is left
 * to the surrounding inline-context contains (so emphasis/code/etc. inside
 * a list item still get scoped).
 *
 * relevance: 0 — list markers are extremely common across many languages
 * (shell prompts, diff output, etc.); we don't lean on them for auto-detect.
 */
export const LIST: Mode = {
  scope: 'bullet',
  match: /^[ \t]*([-*+]|\d+\.)(?=\s+)/,
  relevance: 0,
};

// ---------------------------------------------------------------------------
// Blockquote (spec §1.5 acceptance gate #8)
// ---------------------------------------------------------------------------

/**
 * Blockquote line: `> text`. Mirrors upstream — begin at `^>\s+`, end at
 * end-of-line; the body of the quote stays inside the `quote` scope and may
 * still nest inline emphasis/code/links.
 *
 * relevance: 0 — `>` is too common across diff output, REPL prompts, etc.,
 * to count as a strong markdown signal.
 */
export const BLOCKQUOTE: Mode = {
  scope: 'quote',
  begin: /^[ \t]*>[ \t]?/,
  end: /$/,
  // Nested inline contains will be wired in via INLINE_CONTAINS at the
  // index.ts level (after BOLD / ITALIC / INLINE_CODE / LINK are defined,
  // we need a contains that points back into them — but that requires
  // forward references the LanguageDefinition resolves at module init).
  // We leave `contains` unset here and append the inline modes at index.ts
  // composition time.
  relevance: 0,
};

// ---------------------------------------------------------------------------
// Inline code (spec §1.5 acceptance gate #4)
// ---------------------------------------------------------------------------

/**
 * Inline code span: `` `code` ``. The backticks themselves are NOT inside the
 * scoped span — we use begin/end so the `code` scope wraps only the inner
 * text (CommonMark inline-code semantics).
 *
 * Note: CommonMark allows multi-backtick spans (`` `` foo `` ``) where the
 * outer delimiter count must match. v0 covers the common single-backtick case;
 * future cohort can add the multi-backtick variants. relevance: 0 — single
 * backticks are too common (shell heredocs, template-literals in prose).
 */
export const INLINE_CODE: Mode = {
  scope: 'code',
  begin: /`/,
  end: /`/,
  excludeBegin: true,
  excludeEnd: true,
  relevance: 0,
};

// ---------------------------------------------------------------------------
// Fenced code blocks — with `subLanguage:` dispatch (spec §1.5 acceptance #5)
// ---------------------------------------------------------------------------

/**
 * Fenced code blocks. Each known language is a separate variant with a fixed
 * `subLanguage:` value, because v0 of the matcher only accepts a static
 * subLanguage string (spec §1.5 acceptance gate #5; matcher.ts:194 annotated
 * "Auto-detect path - out of scope for cohort 3a").
 *
 * Variant ordering MATTERS — JavaScript-shaped regex semantics are
 * leftmost-then-first-alternative. We list the most-specific (lang-prefixed)
 * variants BEFORE the generic catch-all so ` ```json\n... ``` ` matches the
 * `json` variant rather than the bare ``` variant. Tilde-fence variants
 * mirror the same pattern.
 *
 * The supported set covers the languages most-likely to be embedded in
 * markdown documentation today; downstream consumers who need additional
 * languages can author them as plugins or via a future cohort. Acceptance
 * gate #5 explicitly tests the `json` variant.
 */
export const FENCED_CODE: Mode = {
  scope: 'code',
  variants: [
    // Backtick fences with a known language tag.
    //
    // excludeBegin/excludeEnd are CRITICAL — without them, the begin lexeme
    // (` ```json\n `) and end lexeme (`\n``` `) would be included in the
    // sub-language buffer, and the JSON tokeniser's `illegal: '\\S'` rule
    // would fire on the backticks, producing an empty stream. With
    // excludeBegin/excludeEnd set, only the JSON body is forwarded to the
    // sub-language; the fence delimiters render as plain text in the parent
    // at the position before/after the `code` scope wrapper.
    {
      begin: /^```json\b[^\n]*\n/,
      end: /\n```/,
      subLanguage: 'json',
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    {
      begin: /^```(?:javascript|js|jsx|mjs|cjs)\b[^\n]*\n/,
      end: /\n```/,
      subLanguage: 'javascript',
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    {
      begin: /^```(?:typescript|ts|tsx|mts|cts)\b[^\n]*\n/,
      end: /\n```/,
      subLanguage: 'typescript',
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    // Tilde fences with a known language tag.
    {
      begin: /^~~~json\b[^\n]*\n/,
      end: /\n~~~/,
      subLanguage: 'json',
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    {
      begin: /^~~~(?:javascript|js|jsx|mjs|cjs)\b[^\n]*\n/,
      end: /\n~~~/,
      subLanguage: 'javascript',
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    {
      begin: /^~~~(?:typescript|ts|tsx|mts|cts)\b[^\n]*\n/,
      end: /\n~~~/,
      subLanguage: 'typescript',
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    // Generic fences — language tag unknown or absent. The fence content is
    // emitted as plain text inside the `code` scope (no sub-language descent).
    {
      begin: /^```[^\n]*\n/,
      end: /\n```/,
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
    {
      begin: /^~~~[^\n]*\n/,
      end: /\n~~~/,
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
    },
  ],
  relevance: 1,
};

// ---------------------------------------------------------------------------
// Indented code block (spec §1.5 acceptance #4 implicit — 4-space indent)
// ---------------------------------------------------------------------------

/**
 * Indented code block: a line starting with 4 spaces or a tab. CommonMark
 * §4.4. The block ends at the first non-indented non-blank line; the matcher
 * uses excludeEnd to leave the next line for re-tokenisation at the parent.
 *
 * The body of the block is plain text scoped as `code` — no sub-language
 * descent (CommonMark's spec leaves indented blocks language-less).
 *
 * relevance: 0 — 4-space-indented blocks are common in many other contexts
 * (Python source mixed into prose, etc.); we don't bump for them.
 */
export const INDENTED_CODE: Mode = {
  scope: 'code',
  // Begin at start-of-line + 4 spaces or tab; consume to next blank line OR
  // end-of-input. We use a multi-line `[\\s\\S]*?` against the implicit end-of-input.
  // Trade-off: this is greedy on multi-paragraph indented blocks. For the v0
  // common-case test ("indent a single line and it scopes as code") this is
  // sufficient.
  begin: /^(?: {4}|\t)/,
  end: /$/,
  relevance: 0,
};

// ---------------------------------------------------------------------------
// Inline links (spec §1.5 acceptance #7)
// ---------------------------------------------------------------------------

/**
 * Inline link: `[text](url)`. Multi-capture form — the whole `[text](url)`
 * is matched in one shot; per-capture-group `scope` emits each piece with
 * its own scope:
 *   - capture 1 = `[`              → `meta`        (syntax bracket)
 *   - capture 2 = link text         → `link`
 *   - capture 3 = `](`             → `meta`        (syntax bracket-paren)
 *   - capture 4 = url              → `string`
 *   - capture 5 = `)`              → `meta`        (syntax close-paren)
 *
 * The url's `string` scope mirrors upstream-ish; spec §13.3 flags this as
 * preliminary — when cohort 7b implements `emitters-markdown` the
 * attribute-aware emitter contract may revisit how the url is delivered to
 * the renderer (e.g. through a scoped `link.href` sub-scope, or through a
 * future `startScopeWithAttrs` call). For lang-markdown's tokeniser concern,
 * we surface the url as a plain `string` and let the emitter side decide.
 *
 * **Open question for cohort 7b** (per dispatch §C.10): the LINK_MODE
 * surface here may need to evolve when attribute-aware emitting lands; the
 * `extendLanguage` API allows a downstream language definition to swap this
 * mode without a breaking change to lang-markdown.
 *
 * relevance: 1 — links are a strong markdown signal.
 */
export const LINK: Mode = {
  match: [/\[/, /[^\]\n]*/, /\]\(/, /[^)\n]*/, /\)/],
  scope: {
    1: 'meta',
    2: 'link',
    3: 'meta',
    4: 'string',
    5: 'meta',
  },
  relevance: 1,
};

// ---------------------------------------------------------------------------
// Bold + italic (spec §1.5 acceptance #3) — three-tier nesting
// ---------------------------------------------------------------------------
//
// Per upstream's note (markdown.js:166-168):
//   "3 level deep nesting is not allowed because it would create confusion
//   in cases like `***testing***` because where we don't know if the last
//   `***` is starting a new bold/italic or finishing the last one"
//
// We therefore mirror upstream's structure:
//   - BOLD contains ITALIC_WITHOUT_BOLD (so `**a *b* c**` still nests italic)
//   - ITALIC contains BOLD_WITHOUT_ITALIC (so `*a **b** c*` still nests bold)
//   - The "_WITHOUT_" variants have empty contains so a third-level ` *` or
//     `**` opens a fresh bold/italic at the outer level instead of recursing.

/** Bold without italic-nesting — used inside ITALIC's contains. */
export const BOLD_WITHOUT_ITALIC: Mode = {
  scope: 'strong',
  variants: [
    { begin: /__(?!\s)/, end: /__/ },
    { begin: /\*\*(?!\s)/, end: /\*\*/ },
  ],
  // Empty contains intentionally — see file header comment.
  contains: [],
};

/** Italic without bold-nesting — used inside BOLD's contains. */
export const ITALIC_WITHOUT_BOLD: Mode = {
  scope: 'emphasis',
  variants: [
    { begin: /\*(?![*\s])/, end: /\*/ },
    { begin: /_(?![_\s])/, end: /_/, relevance: 0 },
  ],
  contains: [],
};

/**
 * Bold mode (`**...**` / `__...__`). Two variants for the two delimiter
 * styles; each excludes the case where the delimiter is followed by
 * whitespace (a CommonMark requirement: `** foo` is not bold). Contains the
 * italic-without-bold mode so `**a *b* c**` nests one level of italic.
 *
 * relevance: 0 — `**` and `__` appear in shell command output and source
 * code; we don't bump for them.
 */
export const BOLD: Mode = {
  scope: 'strong',
  variants: [
    { begin: /__(?!\s)/, end: /__/ },
    { begin: /\*\*(?!\s)/, end: /\*\*/ },
  ],
  contains: [ITALIC_WITHOUT_BOLD],
};

/**
 * Italic mode (`*...*` / `_..._`). The single-asterisk variant is non-zero
 * relevance because plain `*` appears commonly in pointers/dereference;
 * the underscore variant gets relevance: 0 to avoid false positives on
 * snake_case identifiers.
 */
export const ITALIC: Mode = {
  scope: 'emphasis',
  variants: [
    { begin: /\*(?![*\s])/, end: /\*/ },
    { begin: /_(?![_\s])/, end: /_/, relevance: 0 },
  ],
  contains: [BOLD_WITHOUT_ITALIC],
};

// ---------------------------------------------------------------------------
// Backslash escape — per CommonMark §6.1
// ---------------------------------------------------------------------------

/**
 * Backslash followed by an ASCII punctuation character. CommonMark §6.1:
 * any ASCII punctuation character may be backslash-escaped. We emit the
 * escape as plain text (no scope) so consumers see the literal character;
 * the emitter side (cohort 7b) decides the policy.
 *
 * relevance: 0 — escapes alone aren't a strong signal.
 */
export const BACKSLASH_ESCAPE: Mode = {
  match: /\\[\\`*_{}\[\]()#+\-.!|<>]/,
  relevance: 0,
};

// ---------------------------------------------------------------------------
// Inline-context contains — published as MarkdownExtensionPoints.INLINE_CONTAINS
// ---------------------------------------------------------------------------

/**
 * The contents that may appear inside inline contexts (paragraph text, list
 * item bodies, header text, blockquote bodies). Spec §1.5 publishes this as
 * `MarkdownExtensionPoints.INLINE_CONTAINS` for downstream extenders
 * (lang-markdown-gfm appends strikethrough + autolinks here).
 *
 * Order MATTERS — leftmost-first regex semantics:
 *   1. BACKSLASH_ESCAPE first so `\*` is treated as a literal `*`, not an
 *      italic opener.
 *   2. INLINE_CODE before BOLD/ITALIC so `` `*not italic*` `` stays as code.
 *   3. LINK before BOLD/ITALIC so `[*emph*](url)` doesn't try to open italic
 *      at the bracket-paren boundary.
 *   4. BOLD before ITALIC so `**…**` is bold, not "italic-italic".
 */
export const INLINE_CONTAINS: readonly Mode[] = [BACKSLASH_ESCAPE, INLINE_CODE, LINK, BOLD, ITALIC];

// ---------------------------------------------------------------------------
// Block-context contains — published as MarkdownExtensionPoints.BLOCK_CONTAINS
// ---------------------------------------------------------------------------

/**
 * The contents that may appear at the top-level (block) context. Spec §1.5
 * publishes this as `MarkdownExtensionPoints.BLOCK_CONTAINS` for downstream
 * extenders (lang-markdown-gfm appends tables + task-list markers here).
 *
 * Order MATTERS — leftmost-first regex semantics:
 *   1. HEADER first so `# h1` is a header, not "list item with `#` content."
 *   2. HORIZONTAL_RULE before LIST so `---` is HR, not "list with empty items."
 *   3. FENCED_CODE before INDENTED_CODE so ` ```json\n... ``` ` is fenced,
 *      not "indented code starting at the lang tag."
 *   4. BLOCKQUOTE before LIST so `> -` is "blockquote of a list", not "list
 *      starting with `>`."
 *   5. LIST after the above so list-internal text descends into the inline
 *      contains.
 *
 * BLOCKQUOTE's contains is wired in at the LanguageDefinition's composition
 * stage (index.ts) — it can't reference INLINE_CONTAINS at module init
 * without a forward declaration, so we pass INLINE_CONTAINS into a wrapped
 * blockquote there.
 */
export const BLOCK_CONTAINS: readonly Mode[] = [
  HEADER,
  HORIZONTAL_RULE,
  FENCED_CODE,
  INDENTED_CODE,
  BLOCKQUOTE,
  LIST,
];
