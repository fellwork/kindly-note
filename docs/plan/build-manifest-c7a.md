# Build manifest — Cohort 7a: `@kindly-note/lang-markdown`

**Date:** 2026-05-08
**Builder:** Cohort 7a (kindly-note modernize track)
**Branch:** `feat/lang-markdown` (from `main` at `c2f13f2`)
**Spec contract:** `docs/plan/architect-spec.md` (§1.5 — round-3 scope expansion table; §13.2 — dialect strategy; §13.3 — preliminary attribute-aware emitter contract; §5 — emitter contract; §8.2 — keystone reference for the `extensible` surface).
**Depends on:** `@kindly-note/core` (cohorts 1 + 3a + 4 — Mode shape, defineLanguage, sub-language descent), `@kindly-note/lang-helpers` (cohort 2a — Mode helpers; consumed by-type-only in v0 of this package). `@kindly-note/lang-json` is a devDependency for the sub-language acceptance proof test only.

This cohort delivers the **first package in the v1+ markdown ring** (spec §1.5 row `@kindly-note/lang-markdown`). It is the markdown TOKENISER. Semantic HTML rendering (`<h1>`, `<strong>`, `<a href>`) and security defaults (URL allowlists, `<script>` escaping, bidi-control normalisation) are cohort 7b's job per spec §13.1.

---

## Scope summary

A single new package: `@kindly-note/lang-markdown`. Default-exports a deep-frozen `LanguageDefinition<MarkdownExtensionPoints>` whose `contains` covers the most-common 80% of CommonMark via the same `Mode` / `Emitter` contracts every other language uses.

**The architectural proof point** is acceptance gate #5: a fenced code block with a known language tag (` ```json\n{"a":1}\n``` `) dispatches to `lang-json` via `addSubLanguage(stream, 'JSON')` on the parent emitter, with the JSON tokens visible in the inner stream. This validates that the matcher's `subLanguage:` path (cohort 3a) composes cleanly with markdown's `excludeBegin`/`excludeEnd` semantics; without this, embedded code in markdown documents wouldn't highlight.

The keystone `extensible: MarkdownExtensionPoints` surface is declared so the future `@kindly-note/lang-markdown-gfm` (cohort 7+) can `extendLanguage(markdown, { extendPoints: { INLINE_CONTAINS: ..., BLOCK_CONTAINS: ..., LINK_MODE: ... } })` without modifying this package. spec §13.2.

---

## Files created

### `packages/lang-markdown/`

- `package.json` — `@kindly-note/lang-markdown` 0.1.0 (matches the v0 series),
  ESM-only, `sideEffects: false`, root export only, depends on
  `@kindly-note/core` and `@kindly-note/lang-helpers` (^0.1.0).
  `@kindly-note/emitters-html` and `@kindly-note/lang-json` are devDeps for
  tests.
- `tsconfig.json` — extends `../../tsconfig.base.json`, `rootDir: ./src`,
  `outDir: ./dist`, `references: [{ path: ../core }, { path: ../lang-helpers }]`,
  `types: []` (no Node / DOM types in source — spec §1.5 tree-shake gate).
- `tsconfig.test.json` — sibling for Vitest (`composite: false`, `noEmit: true`,
  `types: ['node']`).
- `rolldown.config.ts` — single-entry ESM build, `platform: 'neutral'`,
  `external: [/^@kindly-note\//]`, `dts()` plugin.
- `vitest.config.ts` — extends the workspace-level `vitest.shared.ts` so
  `@kindly-note/*` imports resolve to sibling packages' `src/index.ts` for
  tests (cohort 4 DX fix).

### `packages/lang-markdown/src/`

- `index.ts` — public surface (spec §1.5 row): default-export the deep-frozen
  `LanguageDefinition<MarkdownExtensionPoints>`; named-export the
  `MarkdownExtensionPoints` type so the future `lang-markdown-gfm` can satisfy
  `extendLanguage<MarkdownExtensionPoints>(markdown, ...)` at the call site.
- `extensions.ts` — `MarkdownExtensionPoints` interface — the typed extension
  surface published via `extensible`. Three slots:
    - `INLINE_CONTAINS: readonly Mode[]` — paragraph/list-item/header inline
      contents (GFM strikethrough + autolinks land here).
    - `BLOCK_CONTAINS: readonly Mode[]` — top-level block contents (GFM tables
      + task lists land here).
    - `LINK_MODE: Mode` — the inline-link Mode, reserved for dialects
      (wikilinks, MDX) that want to swap richer link semantics.
- `modes.ts` — Mode-tree fragments. Every mode is documented with its
  acceptance gate, scope, relevance, and (where relevant) the matcher
  constraint that drove the design choice. Top-level exports:
  `HEADER`, `HORIZONTAL_RULE`, `LIST`, `BLOCKQUOTE`, `INLINE_CODE`,
  `FENCED_CODE`, `INDENTED_CODE`, `LINK`, `BOLD`, `ITALIC`,
  `BOLD_WITHOUT_ITALIC`, `ITALIC_WITHOUT_BOLD`, `BACKSLASH_ESCAPE`,
  `INLINE_CONTAINS`, `BLOCK_CONTAINS`.

### `packages/lang-markdown/tests/`

- `markdown.test.ts` — 30 tests covering acceptance gates 2 through 9, plus
  language-shape gates 10/11/12. Helper functions `flattenScopes` /
  `flattenSubLanguages` walk the `_tokenStream` for assertions, mirroring
  the lang-json test pattern.

### Workspace-level

- `tsconfig.json` — added `{ "path": "./packages/lang-markdown" }` to
  references.
- `vitest.shared.ts` — added `'lang-markdown'` to `KINDLY_NOTE_PACKAGES` so
  the alias map resolves `@kindly-note/lang-markdown` → `src/index.ts` in
  tests.
- `.changeset/lang-markdown-initial.md` — `minor` changeset describing the
  initial v0 release.
- `docs/plan/build-manifest-c7a.md` — this file.

---

## CommonMark coverage matrix (spec §1.5 acceptance gates 2-9)

| Feature | Test | Scope | Notes |
|---|---|---|---|
| ATX headers `#` ... `######` | gate 2 | `meta` on hashes, `section` on body | Multi-capture `match: [/^#{1,6}/, /[^\\n]+/]` with `scope: { 1: 'meta', 2: 'section' }`. Covers all 6 levels. |
| Bold `**...**` / `__...__` | gate 3 | `strong` | Mirrors upstream's three-tier `BOLD_WITHOUT_ITALIC` nesting pattern. |
| Italic `*...*` / `_..._` | gate 3 | `emphasis` | Underscore variant has `relevance: 0` to avoid false positives on `snake_case`. |
| Inline code `` `code` `` | gate 4 | `code` | `excludeBegin: true, excludeEnd: true` so backticks are NOT in the scoped span. |
| Fenced code with `subLanguage` | gate 5 (proof point) | `code` + sub-language descent | `excludeBegin: true, excludeEnd: true` so the fence delimiters aren't sent to the sub-language tokeniser (otherwise JSON's `illegal: '\\\\S'` would fire on the backticks). Variants for `json`, `javascript`, `typescript`. |
| Generic fenced code | gate 5 (fallback) | `code` (plain text) | Falls through when language tag is unknown. |
| Indented code (4-space) | implicit gate 4 | `code` | Begin `^(?: {4}|\\t)`, line-scoped. |
| Lists `-`/`*`/`+`/`1.` | gate 6 | `bullet` | List marker only; body falls through to inline contains. |
| Blockquote `> ` | gate 8 | `quote` | Wired with `INLINE_CONTAINS` at language-composition stage so `> **bold**` highlights the bold. |
| Inline link `[text](url)` | gate 7 | `meta`/`link`/`string` | Multi-capture per-group scope: `[` → `meta`, text → `link`, `](` → `meta`, url → `string`, `)` → `meta`. |
| Horizontal rule `---`/`***`/`___` | gate 9 | `meta` | Three explicit variants (no backreference; see "matcher constraints" below). |
| Backslash escape `\\*` etc. | extra | (no scope) | Treated as plain text so `\\*not italic\\*` does not open an italic span. |

---

## Acceptance gates verification

### Gate #1 — All prior tests still pass

**Result:** GREEN. Workspace test count went from 495 → 525 (30 new tests added; zero regressions). Per-package counts unchanged for every existing package.

```
@kindly-note/themes-default            118 passed
@kindly-note/emitters-html              31 passed
@kindly-note/core                       71 passed
@kindly-note/legacy-plugin-adapter      31 passed
@kindly-note/browser                    33 passed
@kindly-note/lang-helpers               64 passed
@kindly-note/loader-fetch               17 passed
@kindly-note/loader-dynamic-import      14 passed
@kindly-note/auto-detect                37 passed
@kindly-note/lang-pack-ecmascript       32 passed
@kindly-note/lang-markdown              30 passed   ← NEW
@kindly-note/lang-javascript            11 passed
@kindly-note/lang-json                  18 passed
@kindly-note/lang-typescript            18 passed
                                        525 total
```

### Gates #2-9 — CommonMark feature highlights

All assertions in `tests/markdown.test.ts` pass. See the matrix above for the per-feature mapping.

### Gate #10 — `extensible: MarkdownExtensionPoints` declared

**Result:** GREEN. `markdown.extensible` is a frozen object exposing `INLINE_CONTAINS` (frozen array of inline modes), `BLOCK_CONTAINS` (frozen array of block modes), and `LINK_MODE` (frozen Mode). Future cohort can author `lang-markdown-gfm` as `extendLanguage(markdown, { extendPoints: { ... } })` per spec §8.2. The shape is documented in `extensions.ts` with the rationale for each slot.

### Gate #11 — No node-builtins, no DOM, no `hljs-` defaults

**Result:** GREEN. `tsconfig.json#types: []`, `rolldown.config.ts#platform: 'neutral'`, no DOM types in source, no string `hljs-` literals in source. Verified by `grep -r 'hljs-\|node:\|process\.\|document\.\|window\.' packages/lang-markdown/src/` returning zero matches.

### Gate #12 — Markdown is auto-detect-eligible

**Result:** GREEN. `disableAutodetect: false` (omitted, treated as falsy). The test asserts `markdown.disableAutodetect` is falsy. Auto-detect relevance scoring is upstream's call.

---

## Matcher constraints encountered (and resolutions)

### Constraint: intra-rule backreferences are broken under MultiRegex's branch wrapper

**Symptom:** initial HORIZONTAL_RULE used `match: /^[ \\t]{0,3}([-*_])(?:[ \\t]*\\1){2,}[ \\t]*$/` with a `\\1` backreference. Tests for `---`, `***`, `___` all failed with `expected [] to include '---'`.

**Root cause:** `packages/core/src/internal/multi-regex.ts:93` wraps each rule in `(...)` for branch tracking. That wrapper renumbers the rule's internal capture groups, breaking the `\\1` backreference (which now points to the wrapper, not the intended `[-*_]` group). Cohort 3a's build manifest noted "inter-rule backrefs are not supported in v0"; intra-rule backrefs through the wrapper are similarly broken.

**Resolution:** enumerate the three delimiter cases as separate variants:

```ts
variants: [
  { match: /^[ \t]{0,3}-(?:[ \t]*-){2,}[ \t]*$/ },   // dashes
  { match: /^[ \t]{0,3}\*(?:[ \t]*\*){2,}[ \t]*$/ },  // asterisks
  { match: /^[ \t]{0,3}_(?:[ \t]*_){2,}[ \t]*$/ },   // underscores
]
```

Trade-off: 3 separate union branches instead of 1 backreferenced branch. Acceptable for v0; a future matcher enhancement could relax the backreference restriction.

### Constraint: sub-language dispatch is static in v0 (no auto-detect for fenced code)

**Symptom:** the matcher (`packages/core/src/internal/matcher.ts:194`) accepts only `subLanguage: string` for v0; `subLanguage: readonly string[]` (auto-detect) is annotated "out of scope for cohort 3a." A naive ` ```${LANG} ` to `subLanguage: LANG` mapping is therefore not possible at the matcher level.

**Resolution:** enumerate the most-common code-fence languages as separate variants in `FENCED_CODE`, each with a fixed `subLanguage` value (`json`, `javascript`, `typescript`). Unknown languages fall through to a plain `code`-scoped block. Future cohort can replace this with auto-detect-array dispatch when the matcher gains it.

### Constraint: sub-language buffer must exclude the fence delimiters

**Symptom:** initial FENCED_CODE without `excludeBegin`/`excludeEnd` shipped the full fenced block (` ```json\n{"a":1}\n``` `) to the JSON tokeniser. JSON's `illegal: '\\\\S'` fired on the first backtick; the engine returned `{relevance: 0, illegal: true}` with an empty stream. Test #5 failed.

**Root cause:** `packages/core/src/highlighter.ts:259` runs the sub-language with `ignoreIllegals: false`. With the matcher's default-`safe` errorMode, an illegal hit returns an empty `TokenStream` (line 314).

**Resolution:** set `excludeBegin: true, excludeEnd: true` on every fenced-code variant. This sends only the inner JSON body to the sub-language tokeniser. The fence delimiters render as plain text in the parent context (before/after the `code` scope wrapper). Documented in `modes.ts` adjacent to the FENCED_CODE definition.

---

## Open questions surfaced for future cohorts

These are documented in the dispatch and inside `modes.ts` / `extensions.ts` source comments where they are most relevant.

### `markdown-attr-1` — Attribute-aware emit for `<a href>`, `<img src>`, `<h1 id>` (cohort 7b)

Spec §13.3 sketches `startScopeWithAttrs(scope, attrs)` as a preliminary v1+ design. lang-markdown v0 surfaces link URLs via the plain `string` scope; the future `@kindly-note/emitters-markdown` will need either:

- (a) the new `startScopeWithAttrs` method on the Emitter contract, OR
- (b) a nested-scope encoding (e.g. `link.href` sub-scope).

`MarkdownExtensionPoints.LINK_MODE` is exposed so a future cohort can swap in an attribute-aware variant without breaking lang-markdown.

### `markdown-fence-1` — Auto-detect dispatch for fenced code (matcher work)

The matcher's `processSubLanguage` (matcher.ts:194) treats non-string `subLanguage` as "out of scope for cohort 3a." When the matcher gains auto-detect-array support, FENCED_CODE can collapse from N language-specific variants to a single ` ``` ` ... ` ``` ` mode whose `subLanguage` is auto-detected from the language tag. Until then, downstream consumers who need additional fence languages must add variants.

### `markdown-html-1` — Raw HTML pass-through (security; cohort 7b)

Spec §13.1 sets `emitters-markdown`'s default policy: "raw HTML in markdown source is escaped. Raw HTML requires `allowHtml: true` AND a `htmlSanitizer` callback." lang-markdown v0 does NOT recognise HTML blocks at all — they fall through as plain text. Cohort 7b decides whether the recogniser belongs in lang-markdown (with a flag) or in emitters-markdown's escape pass.

### `markdown-setext-1` — Setext headers (`===` / `---` underline)

Out of scope for v0. The `---` underline form would conflict with the HORIZONTAL_RULE mode unless we look ahead to the previous line. Future cohort decides whether to add a Setext mode to lang-markdown or to leave it for a CommonMark-strict variant.

### `markdown-ref-1` — Reference-style links `[text][ref]`

Out of scope for v0 (would require tracking link-reference definitions across the document). The matcher is single-pass; reference-style links need a pre-scan. Future cohort can add this as either a plugin (spec §2 transformResult) or a multi-pass mode in lang-markdown.

---

## Verification log

```text
$ bun install                                    [342 packages installed]
$ bun run typecheck                              [tsc -b, exit 0]
$ bun run --filter '@kindly-note/lang-markdown' build
                                                  [rolldown ✔ 377ms; 11.74 KB JS, 3.40 KB d.ts]
$ bun run --filter '@kindly-note/lang-markdown' test
                                                  [30 passed]
$ bun run test                                   [525 passed across 14 packages]
$ bun run lint                                   [biome check . — 160 files, 0 errors]
```

---

## Architectural shifts validated

- **#1 Languages-as-values** — `lang-markdown`'s default export is a frozen `LanguageDefinition` value, not a function that mutates a shared `hljs` argument. (Identical pattern to lang-json / lang-javascript.)
- **#2 Compile-at-register-time, immutable** — `defineLanguage` deep-freezes the definition at module init; the matcher in `@kindly-note/core` compiles a fresh `CompiledLanguage` at register time. The `extensible` arrays (INLINE_CONTAINS / BLOCK_CONTAINS / LINK_MODE) are frozen and ready for `extendLanguage` to consume without mutation.
- **#5 The keystone `extendLanguage()` API** — `MarkdownExtensionPoints` is published via the typed `extensible` field. The future `@kindly-note/lang-markdown-gfm` (spec §13.2 dialect strategy) will compose via `extendLanguage(markdown, { extendPoints: { ... } })` — exercising the keystone API in a SECOND domain (after the JS → TS keystone of cohort 4). This is a meaningful architectural validation: the extension surface designed for class-based language inheritance also fits dialect-extension cleanly.

---

## Bundle size

```text
packages/lang-markdown/dist/index.js   — 11.74 kB
packages/lang-markdown/dist/index.d.ts —  3.40 kB
```

Comparable to lang-javascript's similar surface; no Node/DOM imports leaked. Tree-shaking is preserved (`sideEffects: false`).

---

STATUS: DONE — 30/30 acceptance tests pass, 525/525 workspace tests pass, typecheck clean, build green, lint clean. CommonMark v0 coverage delivered with sub-language dispatch validated for `lang-json`. Open questions surfaced as `markdown-attr-1` / `markdown-fence-1` / `markdown-html-1` / `markdown-setext-1` / `markdown-ref-1` for cohort 7b and beyond.
