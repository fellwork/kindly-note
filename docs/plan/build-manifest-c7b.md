# Build manifest — cohort 7b: the markdown rendering ring

**Branch:** `feat/markdown-emitter-7b` | **Type:** Builder build-manifest
**Source plan:** Topic Director r2 cross-repo build plan (`team read by-id c7720995-…`); architect-spec §1.5 (surface rows) + §13 (security/dialect contract) + §13.3a (`startScopeWithAttrs` decision (a)).
**Packages shipped this cohort:**
`@kindly-note/core` (0.1.0 → **0.2.0**, minor), `@kindly-note/emitters-markdown` (NEW, 0.1.0), `@kindly-note/render-markdown` (NEW, 0.1.0).

This cohort implements KN-1 + KN-2 + KN-3 of the Director plan. KN-4 (`lang-markdown-gfm`) is **deferred** per decision D1 (default: defer). GFM is explicitly out of scope and proven-absent by tests.

---

## KN-1 — `@kindly-note/core` 0.2.0 (the contract bump)

Spec §13.3a, decision (a): add the **optional** `startScopeWithAttrs?(scope, attrs)` to the `Emitter` interface. Backward-compatible — existing emitters (`emitters-html`, the internal recording emitter) do not implement it.

Files touched:
- `src/emitter.ts` — added the optional method to the `Emitter<TOutput>` interface (documented as core-0.2.0, optional, balanced by `endScope`).
- `src/language.ts` — `Mode` gains an optional static `attrs?: Readonly<Record<string,string>>` payload.
- `src/compile.ts` — `CompiledMode` gains `attrs`; `compileMode` forwards it.
- `src/internal/matcher.ts` — new `openScope(scope, attrs)` helper: when a mode carries `attrs` AND the emitter implements `startScopeWithAttrs`, route through it; otherwise fall back to `startScope`. Used in both the `startNewMode` path and the multi-capture begin path. Modes without `attrs` are unchanged.

Tests: `tests/start-scope-with-attrs.test.ts` (3) proves (a) attrs route through `startScopeWithAttrs` with the exact payload, (b) fallback to `startScope` when the method is absent, (c) attrs-less modes always use `startScope`. **All 71 pre-existing core tests pass unchanged** (backward-compat gate); 74 total.

**NOTE on the v0 lang-markdown tokeniser:** it carries NO `attrs` — it surfaces link URLs as a sibling `string` scope, headings as `meta`+`section`, etc. So the matcher's attrs plumbing is a forward-looking hook for attribute-aware *language definitions*; the markdown *emitter* reconstructs `<a href>` / heading levels by interpreting the scope stream (see KN-2). The `startScopeWithAttrs` contract still matters: `emitters-markdown` **implements** it (so any future attrs-carrying mode works), and the type-level addition is what lets it declare the method.

---

## KN-2 — `@kindly-note/emitters-markdown` (the renderer, the bulk of the work)

The architectural reality (verified by probing the live token stream — see below): **`@kindly-note/lang-markdown` is a highlight-style tokeniser, not a markdown AST.** It emits a flat, line-oriented stream of scopes (`meta`/`section`/`strong`/`emphasis`/`code`/`quote`/`bullet`/`link`/`string`) over the raw source. Block boundaries (paragraphs, fences, list grouping) live in the PLAIN TEXT around those scopes. So `emitters-markdown` is a **reinterpreting renderer**: it records the engine's calls into a token tree, then `render()` runs a block-structuring + inline pass that reconstructs semantic HTML, applying the §13.1 security policy token-by-token.

Observed token-stream shapes (the design basis):
- Heading `# H` → `meta("#")` + `section(" H")` siblings.
- Bold/italic → `strong`/`emphasis` scope wrapping text **including** the `**`/`*` delimiters (stripped by the renderer).
- Inline code → `code` scope (clean inner text) with the backtick delimiters in the surrounding text (stripped by the renderer).
- Link → `meta("[")` + `link(text)` + `meta("](")` + `string(url)` + `meta(")")` flat sequence (reconstructed into `<a href>`).
- List → `bullet(marker)` + following plain text per line (grouped into `<ul>`/`<ol>`).
- Blockquote → `quote` scope containing `> ` + nested inline scopes.
- Fenced code → fence-delimiter text + `code` scope (holding a `sub-language` node for known langs, else plain text).
- Raw HTML / blank-line paragraph splits → untokenised plain text.

Source layout:
- `src/escape.ts` — `htmlEscape` (5-char over-escape, attr+text safe) + `normalizeBidi` (U+FFFD-normalises 16 bidi/invisible control code points — trojan-source mitigation).
- `src/url-policy.ts` — `UrlPolicy` type, `allowlistUrlPolicy`, `defaultUrlPolicy` (allow `http`/`https`/`mailto`/`tel` + relative + fragment), with control-char scheme-obfuscation defence.
- `src/render.ts` — the block-structuring + inline pass (lower scope tree → flat atoms → normalise fences/inline-code → split lines → group blocks → render). The §13.1 security policy is applied here.
- `src/emitter.ts` — the `MarkdownHtmlEmitter` class (implements `startScopeWithAttrs`), `markdownHtmlEmitterWith(config)`, `markdownHtmlEmitter`, the default code-fence renderer (delegates to `@kindly-note/emitters-html`'s `toClassNames`).
- `src/index.ts` — public surface.

Security matrix coverage (spec §13.1), all proven by `tests/render.test.ts` + `tests/url-policy.test.ts` + `tests/escape.test.ts` (40 tests):

| Vector | kindly-note default | test |
|---|---|---|
| Raw HTML (`<script>`, `<img onerror>`) | escaped (no live tag/attr) | render.test §SECURITY |
| `javascript:` / `vbscript:` / `data:` / `file:` URLs | anchor with NO href, text preserved | render + url-policy |
| `on*` handlers | structurally impossible to emit | render.test |
| bidi controls (U+202E etc.) | normalised to U+FFFD | escape + render |
| control-char scheme obfuscation (`java\tscript:`) | defeated | url-policy |
| code-fence content | HTML-escaped, then highlighted | render.test |

Config knobs (overridable for trusted contexts): `allowHtml` + `htmlSanitizer`, `urlAllowlist`, `urlPolicy`, `codeEmitter`, `allowDataImages`, `preserveBidiControls`.

---

## KN-3 — `@kindly-note/render-markdown` (one-call convenience)

`renderMarkdown(src, opts) -> string`. Composes `lang-markdown` + `markdownHtmlEmitterWith` + a Highlighter. `RenderMarkdownOptions extends MarkdownHtmlEmitterConfig` and adds `languages` (code-fence packs), `highlighter` (adopt a caller's registered languages), `classPrefix`. **This is the package the aihu `<aihu-markdown>` adapter imports.** Tests: `tests/render-markdown.test.ts` (9) — full CommonMark sample, JS-fence highlighting end-to-end, supplied-highlighter path, security inheritance, GFM-absence.

### Public API for the aihu-side adapter Builder

```ts
import { renderMarkdown, type RenderMarkdownOptions } from '@kindly-note/render-markdown';
const html: string = renderMarkdown(src, opts?);
```

- **Synchronous, returns an HTML string.** No async (spec §13.5).
- **Safe by default** — the adapter can drop the result into `innerHTML`/`nodeValue` without further sanitisation for the default config.
- To highlight code fences the adapter passes `{ languages: [json, javascript, …] }` (or a pre-built `{ highlighter }`).
- `classPrefix` defaults to `kn-` (matches `@kindly-note/themes-default`).
- Re-exports `MarkdownHtmlEmitterConfig`, `UrlPolicy`, `HtmlSanitizer`, `CodeFenceRenderer` types.

---

## Verification (this branch, HEAD)

- `bun run test` — **587 tests pass, 0 fail** across 16 packages (core 74, emitters-markdown 40, render-markdown 9; 49 net-new).
- `bun run typecheck` — clean (`tsc -b`).
- `bun run lint` — clean (biome).
- `bun run build` — all 16 packages build; `emitters-markdown` + `render-markdown` produce dist/ artifacts + `.d.ts`.

`renderMarkdown()` sample output (CommonMark → semantic HTML, JS fence highlighted):
```
<h1>Getting Started</h1>
<p>Welcome to <strong>kindly-note</strong>. It renders <em>CommonMark</em> with a <a href="https://example.com">safe link</a> and inline <code>code</code>.</p>
<h2>Features</h2>
<ul><li>security-first defaults</li><li>semantic HTML</li><li>code highlighting</li></ul>
<ol><li>install</li><li>import</li><li>render</li></ol>
<blockquote><p>A blockquote with <strong>emphasis</strong>.</p></blockquote>
<pre><code><span class="kn-keyword">const</span> greet = (name) =&gt; <span class="kn-string">`hi <span class="kn-subst">${name}</span>`</span>;</code></pre>
<hr>
```

Security proof:
```
input:  hello <script>alert(document.cookie)</script> world
output: <p>hello &lt;script&gt;alert(document.cookie)&lt;/script&gt; world</p>
input:  [click me](javascript:alert(1))
output: <p><a>click me</a>)</p>   ← no href; dangerous scheme neutralised
```

---

## Changesets

- `.changeset/core-start-scope-with-attrs.md` — `@kindly-note/core: minor`.
- `.changeset/emitters-markdown-initial.md` — `@kindly-note/emitters-markdown: minor` (initial).
- `.changeset/render-markdown-initial.md` — `@kindly-note/render-markdown: minor` (initial).

### Team-Lead notes for the "Version Packages" PR

1. **Core version is `0.1.0` in source on this branch** (NOT manually bumped). The `minor` changeset bumps it to `0.2.0` at `changeset version` time. The new packages declare `@kindly-note/core@^0.1.0` so `changeset status` validates cleanly against the current snapshot. **Per the spec the runtime floor is `core@^0.2.0`** (the new packages need the `startScopeWithAttrs` contract); after the core bump lands, the ranges may be tightened to `^0.2.0` (a non-breaking tightening) if desired. Functionally `^0.1.0` is safe because `startScopeWithAttrs` is an *added* optional method and the matcher fallback is backward-compatible.
2. **Pre-1.0 `minor` quirk (publish.md lesson #4):** `bun x changeset status --verbose` currently projects `1.0.0` for the new packages and cascades `major`/`1.0.0` onto core's dependents (browser, emitters-html, legacy-plugin-adapter). This is the documented changesets pre-1.0 anomaly — **verify and manually correct the projected versions** at version-time (core → 0.2.0; new packages → 0.1.0; dependents → 0.1.1 patch from the core peer refresh, not 1.0.0).
3. **Do NOT publish from this branch** — publishing is the Team Lead's post-review step via `release.yml`.

---

## Out of scope (proven absent)

- **GFM** (tables / task-lists / strikethrough / autolinks) — `@kindly-note/lang-markdown-gfm` (KN-4), deferred (D1). Tests assert no `<table>`/`<del>`/`<input type=checkbox>` output.
- **Reference-style links, setext headings, raw-HTML blocks, images** — not produced by the v0 lang-markdown tokeniser (cohort 7a OPEN-QUESTION block). The emitter handles whatever the tokeniser emits; richer markdown lands when the tokeniser gains those modes (the `attrs` + `startScopeWithAttrs` contract is ready for image `src`/heading `id` when they do).
