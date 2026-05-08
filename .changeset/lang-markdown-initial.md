---
'@kindly-note/lang-markdown': minor
---

Initial release of `@kindly-note/lang-markdown` — CommonMark language definition for kindly-note.

This is the **first package in the v1+ markdown ring** (per spec §1.5 / §13). Cohort 7b will follow with `emitters-markdown` (semantic HTML + security defaults) and `render-markdown` (convenience entry).

`lang-markdown` tokenises markdown source as a kindly-note language — same `Mode` / `Emitter` contracts as every other language. Rendering of the resulting token stream as semantic HTML (`<h1>`, `<strong>`, `<a href>`, …) is cohort 7b's job.

**v0 CommonMark coverage (the most-common 80%):**

- ATX headers (`#` … `######`) — `meta` on hashes, `section` on body
- Bold (`**`/`__`) — `strong`
- Italic (`*`/`_`) — `emphasis`
- Three-tier nesting via the upstream `BOLD_WITHOUT_ITALIC` / `ITALIC_WITHOUT_BOLD` pattern
- Inline code (`` ` ``) — `code` (delimiters not in the scoped span)
- Fenced code blocks (` ``` `, `~~~`) — `code` scope, with `subLanguage:` dispatch for `json`, `javascript`, `typescript` (the v0 acceptance proof point)
- Indented code blocks (4-space) — `code`
- Blockquotes (`> `) — `quote` with inline modes nested inside
- Lists (`-`, `*`, `+`, `1.`) — `bullet`
- Inline links (`[text](url)`) — `link` on text, `string` on url, `meta` on syntax brackets
- Horizontal rules (`---`/`***`/`___`) — `meta`
- Backslash escapes — passed through as plain text

**Out of scope for v0** (open questions in the build manifest): Setext headers, reference-style links, raw HTML blocks, GFM (tables / task lists / strikethrough / autolinks — those are a SEPARATE `@kindly-note/lang-markdown-gfm` package per spec §13.2).

**Typed extension surface (`MarkdownExtensionPoints`)** is published via the keystone `extensible` API (spec §8.2):

- `INLINE_CONTAINS` — descendants append inline tokens (GFM strikethrough + autolinks land here)
- `BLOCK_CONTAINS` — descendants append block-level tokens (GFM tables + task lists)
- `LINK_MODE` — reserved for future dialects (wikilinks, MDX components)

The future `@kindly-note/lang-markdown-gfm` will compose via `extendLanguage(markdown, { extendPoints: { ... } })` without modifying this package.
