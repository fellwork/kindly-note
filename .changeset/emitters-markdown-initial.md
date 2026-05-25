---
'@kindly-note/emitters-markdown': minor
---

Initial release of `@kindly-note/emitters-markdown` — a semantic-HTML emitter for the `@kindly-note/lang-markdown` token stream, with **security-first defaults** (spec §1.5 / §13).

It consumes the highlight-style CommonMark token stream and reconstructs semantic HTML: `<h1>`–`<h6>`, `<p>`, `<strong>`, `<em>`, `<code>`, `<pre><code>` (with sub-language code-fence highlighting delegated to `@kindly-note/emitters-html`), `<a href>`, `<ul>`/`<ol>`/`<li>`, `<blockquote>`, and `<hr>`.

**Security (spec §13.1) — defaults, all overridable via `markdownHtmlEmitterWith({ … })`:**

- Raw/embedded HTML is **escaped** (it arrives as plain text; the emitter has no code path that emits a user-content tag). `allowHtml` + a user-supplied `htmlSanitizer` is required to pass raw HTML through.
- Link URLs run through a scheme allowlist (`http`, `https`, `mailto`, `tel`, plus relative + fragment URLs). Blocked schemes (`javascript:`, `data:`, `vbscript:`, `file:`, …) yield an anchor with **no `href`** — link text preserved. Control-character scheme obfuscation (`java\tscript:`) is defeated. Override via `urlAllowlist` or `urlPolicy`.
- `on*` event-handler attributes can **never** be emitted (structural guarantee).
- Unicode bidi/invisible control characters are normalised to U+FFFD by default (trojan-source mitigation). Override via `preserveBidiControls: true`.
- Code-fence content is HTML-escaped before highlighting.

Exports: `markdownHtmlEmitter`, `markdownHtmlEmitterWith`, `MarkdownHtmlEmitterConfig`, `HtmlSanitizer`, `CodeFenceRenderer`, `UrlPolicy`, `allowlistUrlPolicy`, `defaultUrlPolicy`, `DEFAULT_URL_ALLOWLIST`, `htmlEscape`, `normalizeBidi`.

Requires `@kindly-note/core@^0.2.0` (the `startScopeWithAttrs` Emitter contract). GFM (tables / task-lists / strikethrough / autolinks) is intentionally out of scope — that is `@kindly-note/lang-markdown-gfm`.
