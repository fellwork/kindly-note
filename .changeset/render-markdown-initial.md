---
'@kindly-note/render-markdown': minor
---

Initial release of `@kindly-note/render-markdown` — the one-call markdown → safe HTML convenience entry point (spec §1.5 / §13).

`renderMarkdown(src, opts) -> string` composes `@kindly-note/lang-markdown` (CommonMark tokeniser) + `@kindly-note/emitters-markdown` (semantic-HTML emitter with security-first defaults) + a `@kindly-note/core` Highlighter into a single call. It owns no rendering logic itself — all semantic-HTML and security behaviour lives in `emitters-markdown`; this wrapper only wires the pieces together.

```ts
import { renderMarkdown } from '@kindly-note/render-markdown';
import javascript from '@kindly-note/lang-javascript';

const html = renderMarkdown('# Hi\n```js\nfoo()\n```', { languages: [javascript] });
```

`RenderMarkdownOptions` extends `MarkdownHtmlEmitterConfig` (security knobs: `allowHtml`, `htmlSanitizer`, `urlAllowlist`, `urlPolicy`, `codeEmitter`, `allowDataImages`, `preserveBidiControls`) and adds composition knobs: `languages` (extra `lang-*` packs for code-fence highlighting), `highlighter` (reuse a pre-built Highlighter's registered languages), and `classPrefix`.

Security-first by default; pass the config fields to relax for trusted content. GFM is out of scope (use `@kindly-note/lang-markdown-gfm`). Requires `@kindly-note/core@^0.2.0`.
