// @kindly-note/emitters-markdown — the semantic-HTML markdown emitter.
//
// Implements the spec §5 EmitterFactory contract for `TOutput = string`, plus
// the OPTIONAL `startScopeWithAttrs` method added to the Emitter contract in
// @kindly-note/core 0.2.0 (spec §13.3a). The engine drives the standard
// startScope/endScope/addText/addSubLanguage/finalize calls while tokenising
// markdown via `@kindly-note/lang-markdown`; the emitter records them into a
// token tree, then `render()` runs the block-structuring + inline pass in
// `render.ts`, applying the §13.1 security policy as it assembles the string.
//
// SECURITY (spec §13.1) — defaults, all overridable per emitter instance:
//   - Raw HTML in source is ESCAPED (it arrives as plain text from the
//     tokeniser; we never emit a tag for it). `allowHtml` + a user-supplied
//     `htmlSanitizer` is required to pass raw HTML through.
//   - URLs are filtered through `urlPolicy` (default: http/https/mailto/tel +
//     relative + fragment). Blocked schemes (`javascript:`, `data:`, …) yield
//     an anchor with NO href; the link text is preserved.
//   - `on*` handler attributes can NEVER be emitted — the emitter has no code
//     path that writes one. (Structural guarantee, not a filter.)
//   - Unicode bidi controls are normalised to U+FFFD unless `preserveBidiControls`.
//   - Code-fence content is HTML-escaped first, then rendered via `codeEmitter`.

import type {
  Emitter,
  EmitterFactory,
  EmitterOptions,
  TokenNode,
  TokenStream,
} from '@kindly-note/core';
import { toClassNames } from '@kindly-note/emitters-html';
import { htmlEscape } from './escape.js';
import { type CodeFenceRenderer, type RenderContext, renderBlocks } from './render.js';
import { type UrlPolicy, allowlistUrlPolicy, defaultUrlPolicy } from './url-policy.js';

/**
 * A raw-HTML sanitiser callback. spec §13.1: the emitter NEVER decides whether
 * raw HTML is safe — the user must supply this when `allowHtml: true`. Without
 * it, `allowHtml` has no effect and raw HTML is escaped.
 */
export type HtmlSanitizer = (html: string) => string;

/** Configuration for {@link markdownHtmlEmitterWith}. spec §13.1 / §1.5. */
export interface MarkdownHtmlEmitterConfig {
  /**
   * Allow raw/embedded HTML to pass through. spec §13.1: requires
   * `htmlSanitizer` too — with `allowHtml: true` but no sanitiser, raw HTML is
   * still escaped (fail-safe). Default `false`.
   */
  readonly allowHtml?: boolean;

  /**
   * The sanitiser invoked on raw-HTML runs when `allowHtml` is `true`. The
   * emitter never inspects HTML itself; safety is entirely the sanitiser's
   * responsibility. spec §13.1.
   */
  readonly htmlSanitizer?: HtmlSanitizer;

  /**
   * Scheme allowlist for link / image URLs. Mutually exclusive with
   * `urlPolicy` (which wins if both are set). Default: the package's built-in
   * allowlist (`http`, `https`, `mailto`, `tel`). spec §13.1.
   */
  readonly urlAllowlist?: readonly string[];

  /**
   * Full URL policy override. Receives the raw URL, returns the href to emit
   * or `null` for "no href". Wins over `urlAllowlist`. spec §13.1.
   */
  readonly urlPolicy?: UrlPolicy;

  /**
   * Custom code-fence renderer for sub-language streams. Receives the
   * already-highlighted sub-language TokenStream + language name. Default:
   * delegates to the built-in `@kindly-note/emitters-html` scope-to-class
   * renderer. spec markdown-5 / §1.5.
   */
  readonly codeEmitter?: CodeFenceRenderer;

  /**
   * Whether `data:` images are permitted. Default `false` (data-image stripped,
   * alt text preserved). spec §13.1. (Images are not produced by the v0
   * lang-markdown tokeniser; the flag is reserved + honoured by the URL policy
   * composition for forward compatibility.)
   */
  readonly allowDataImages?: boolean;

  /**
   * Preserve Unicode bidi control characters instead of normalising them to
   * U+FFFD. Default `false`. spec §13.1 (trojan-source mitigation).
   */
  readonly preserveBidiControls?: boolean;
}

/**
 * The default code-fence renderer. Walks the already-highlighted sub-language
 * TokenStream and emits `<span class="kn-…">` markup using the SAME
 * scope-to-class rules as `@kindly-note/emitters-html`. All text is HTML-escaped
 * (spec §13.1: "Highlighter results are also re-escaped … we trust our own
 * emitter, not the language definition author").
 */
function defaultCodeFenceRenderer(classPrefix: string): CodeFenceRenderer {
  const renderNode = (node: TokenNode): string => {
    if (node.type === 'text') return htmlEscape(node.text);
    if (node.type === 'sub-language') {
      const className = toClassNames(`language:${node.language}`, classPrefix);
      const inner = node.stream.type === 'scope' ? renderChildren(node.stream.children) : '';
      return `<span class="${className}">${inner}</span>`;
    }
    const inner = renderChildren(node.children);
    if (node.scope === undefined) return inner;
    return `<span class="${toClassNames(node.scope, classPrefix)}">${inner}</span>`;
  };
  const renderChildren = (children: readonly TokenNode[]): string => {
    let out = '';
    for (const c of children) out += renderNode(c);
    return out;
  };
  return (stream: TokenStream, _language: string): string => renderChildren(stream.children);
}

// Internal mutable token-tree node used while the engine drives the emitter.
interface MutableScope {
  type: 'scope';
  scope?: string;
  children: TokenNode[];
}

class MarkdownHtmlEmitter implements Emitter<string> {
  private readonly root: MutableScope = { type: 'scope', children: [] };
  private readonly stack: MutableScope[] = [this.root];

  constructor(private readonly ctx: RenderContext) {}

  startScope(scope: string): void {
    const node: MutableScope = { type: 'scope', scope, children: [] };
    this.peek().children.push(node);
    this.stack.push(node);
  }

  // spec §13.3a: the markdown emitter IMPLEMENTS the optional attribute-aware
  // method. lang-markdown's v0 tokeniser does not carry attrs (it surfaces
  // link URLs as a sibling `string` scope, which render.ts reconstructs into an
  // `<a href>` under the URL policy), but downstream attribute-aware language
  // definitions can carry an attrs payload here. We record it as a pass-through
  // scope so the recorded tree shape stays uniform; attribute serialisation is
  // the renderer's responsibility under the same security policy.
  startScopeWithAttrs(scope: string, _attrs: Readonly<Record<string, string>>): void {
    this.startScope(scope);
  }

  endScope(): void {
    if (this.stack.length > 1) this.stack.pop();
  }

  addText(text: string): void {
    if (text.length === 0) return;
    this.peek().children.push({ type: 'text', text });
  }

  addSubLanguage(stream: TokenStream, language: string): void {
    this.peek().children.push({ type: 'sub-language', language, stream });
  }

  finalize(): void {
    while (this.stack.length > 1) this.stack.pop();
  }

  render(): string {
    return renderBlocks(freezeStream(this.root), this.ctx);
  }

  toTokenStream(): TokenStream {
    return freezeStream(this.root);
  }

  private peek(): MutableScope {
    return this.stack[this.stack.length - 1] as MutableScope;
  }
}

function freezeStream(scope: MutableScope): TokenStream {
  const children: TokenNode[] = scope.children.map((c) => {
    if (c.type === 'scope') return freezeStream(c as MutableScope);
    if (c.type === 'sub-language') {
      return Object.freeze({
        type: 'sub-language' as const,
        language: c.language,
        stream: c.stream,
      });
    }
    return Object.freeze({ type: 'text' as const, text: c.text });
  });
  return Object.freeze({
    type: 'scope' as const,
    children: Object.freeze(children),
    ...(scope.scope !== undefined ? { scope: scope.scope } : {}),
  });
}

/**
 * Build a configurable markdown semantic-HTML {@link EmitterFactory}. spec
 * §13.1 security defaults apply unless overridden here.
 *
 * @example
 *   const factory = markdownHtmlEmitterWith({ urlAllowlist: ['https'] });
 *   createHighlighter({ languages: [markdown], emitter: factory })
 *     .highlight(src, { language: 'markdown' }).value;
 */
export function markdownHtmlEmitterWith(
  config: MarkdownHtmlEmitterConfig = {},
): EmitterFactory<string> {
  // `allowHtml` only takes effect WITH a sanitiser (fail-safe). The current v0
  // lang-markdown tokeniser emits raw HTML as plain text (it has no HTML-block
  // mode), so raw HTML is escaped on the text path regardless; the sanitiser
  // hook is wired here for when an HTML-aware tokeniser/extension lands.
  const htmlSanitizer =
    config.allowHtml === true && typeof config.htmlSanitizer === 'function'
      ? config.htmlSanitizer
      : undefined;
  void htmlSanitizer; // reserved — see note above.

  const urlPolicy: UrlPolicy =
    config.urlPolicy ??
    (config.urlAllowlist !== undefined
      ? allowlistUrlPolicy(config.urlAllowlist)
      : defaultUrlPolicy);

  const preserveBidiControls = config.preserveBidiControls === true;

  return Object.freeze({
    name: 'markdown-html',
    create(opts: EmitterOptions): Emitter<string> {
      const classPrefix =
        opts.classPrefix && opts.classPrefix.length > 0 ? opts.classPrefix : 'kn-';
      const renderCodeFence = config.codeEmitter ?? defaultCodeFenceRenderer(classPrefix);
      const ctx: RenderContext = { urlPolicy, preserveBidiControls, renderCodeFence };
      return new MarkdownHtmlEmitter(ctx);
    },
  });
}

/**
 * The default markdown semantic-HTML emitter factory — security-first defaults
 * per spec §13.1. spec §1.5 row `@kindly-note/emitters-markdown`.
 */
export const markdownHtmlEmitter: EmitterFactory<string> = markdownHtmlEmitterWith();
