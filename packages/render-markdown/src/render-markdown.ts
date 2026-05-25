// renderMarkdown — the one-call markdown → safe HTML convenience entry point.
//
// spec §1.5 row `@kindly-note/render-markdown`:
//   `renderMarkdown(md, opts) → safe HTML string in one call. Composes
//    @kindly-note/lang-markdown + @kindly-note/emitters-markdown + a sensible
//    Highlighter.`
//
// This is the package the downstream aihu `<aihu-markdown>` adapter imports.
// It owns NO rendering logic of its own — all semantic-HTML + security behaviour
// lives in @kindly-note/emitters-markdown (spec §13.1); this wrapper only wires
// the tokeniser, emitter, and code-fence language packs together.

import { type Highlighter, createHighlighter } from '@kindly-note/core';
import type { LanguageDefinition } from '@kindly-note/core';
import {
  type MarkdownHtmlEmitterConfig,
  markdownHtmlEmitterWith,
} from '@kindly-note/emitters-markdown';
import markdown from '@kindly-note/lang-markdown';

/**
 * Options for {@link renderMarkdown}. Extends the security/emitter config of
 * `@kindly-note/emitters-markdown` (spec §13.1: `allowHtml`, `htmlSanitizer`,
 * `urlAllowlist`, `urlPolicy`, `codeEmitter`, `allowDataImages`,
 * `preserveBidiControls`) with composition knobs.
 */
export interface RenderMarkdownOptions extends MarkdownHtmlEmitterConfig {
  /**
   * Extra `@kindly-note/lang-*` definitions to register for code-fence
   * highlighting (e.g. `[json, javascript, typescript]`). Fenced code whose
   * tag resolves to one of these is highlighted; unknown languages render as
   * escaped plain text. spec §1.5 (optional lang-* peers).
   */
  readonly languages?: readonly LanguageDefinition<unknown>[];

  /**
   * A pre-built {@link Highlighter} to reuse instead of constructing a fresh
   * one per call. Useful when the caller already manages a registry of
   * languages. spec §1.5 usage example (`renderMarkdown(md, { highlighter: hl })`).
   *
   * When supplied, `languages` is ignored (the caller owns registration) and
   * the markdown language is registered onto it if not already present.
   */
  readonly highlighter?: Highlighter;

  /**
   * CSS class prefix for highlighted code-fence spans. Default `'kn-'`
   * (matches `@kindly-note/themes-default`). spec §7.4.
   */
  readonly classPrefix?: string;
}

/**
 * Render a CommonMark markdown string to a safe semantic-HTML string in one
 * call. spec §1.5 / §13.
 *
 * Security-first by default (spec §13.1): raw HTML is escaped, dangerous URL
 * schemes are neutralised, `on*` handlers can never be emitted, and Unicode
 * bidi controls are normalised. Pass the `MarkdownHtmlEmitterConfig` fields to
 * relax these for trusted content.
 *
 * GFM (tables / task-lists / strikethrough / autolinks) is intentionally NOT
 * supported — that is `@kindly-note/lang-markdown-gfm` (spec §13.2).
 *
 * @example
 *   import { renderMarkdown } from '@kindly-note/render-markdown';
 *   import javascript from '@kindly-note/lang-javascript';
 *   const html = renderMarkdown('# Hi\n```js\nfoo()\n```', { languages: [javascript] });
 */
export function renderMarkdown(src: string, opts: RenderMarkdownOptions = {}): string {
  const { languages, highlighter: provided, classPrefix, ...emitterConfig } = opts;

  const emitter = markdownHtmlEmitterWith(emitterConfig);

  // The Highlighter's emitter is fixed at construction time, so render-markdown
  // always owns the markdown emitter (it carries the security contract). When
  // the caller supplies a `highlighter`, we adopt its registered code-fence
  // languages onto a fresh markdown-emitter highlighter rather than mutating
  // the caller's instance.
  const fenceLanguages = provided !== undefined ? languagesFrom(provided) : (languages ?? []);

  const hl = createHighlighter({
    languages: [markdown, ...fenceLanguages],
    emitter,
    ...(classPrefix !== undefined ? { classPrefix } : {}),
  });
  return hl.highlight(src, { language: 'markdown' }).value;
}

/**
 * Recover the registered `LanguageDefinition`s from a Highlighter so they can
 * be re-registered onto the markdown-emitter highlighter. spec §1.5: optional
 * lang-* peers feed code-fence highlighting.
 */
function languagesFrom(hl: Highlighter): readonly LanguageDefinition<unknown>[] {
  const out: LanguageDefinition<unknown>[] = [];
  for (const name of hl.listLanguages()) {
    const handle = hl.getLanguage(name);
    if (handle !== undefined && handle.definition.name !== 'Markdown') {
      out.push(handle.definition);
    }
  }
  return out;
}
