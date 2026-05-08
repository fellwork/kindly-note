// @kindly-note/emitters-html — the default HTML-string emitter.
//
// Implements spec §5 EmitterFactory contract for `TOutput = string`.
// Two-pass design (Scout §5):
//   1. Engine drives startScope/endScope/addText/addSubLanguage/finalize, building an
//      internal token tree.
//   2. render() walks the tree once and emits HTML.
//
// The emitter is a pure value: zero `node:` imports, zero DOM access, zero global
// state. One factory instance can serve any number of concurrent highlight calls
// because each `create()` returns a fresh per-call Emitter.
//
// Sub-language boundary (spec §5.6): addSubLanguage receives a TokenStream value,
// not a foreign Emitter. The parent emitter walks that TokenStream the same way it
// walks its own internal tree — there is no path through which it could read another
// emitter's internals. This eliminates the upstream `__addSublanguage(emitter)` leak
// (Scout §5).

import type {
  Emitter,
  EmitterFactory,
  EmitterOptions,
  TokenNode,
  TokenStream,
} from '@kindly-note/core';
import { htmlEscape } from './escape.js';
import { toClassNames } from './scope-to-class.js';

/** Default class prefix per spec §7.4 (round-1 user lock). */
export const DEFAULT_CLASS_PREFIX = 'kn-';

/** Configuration for the HTML emitter factory. spec §5.3 / §7.4. */
export interface HtmlEmitterConfig {
  /**
   * CSS class prefix applied to scope-derived class names.
   * Defaults to {@link DEFAULT_CLASS_PREFIX} (`'kn-'`). Pass `'hljs-'` to opt
   * into upstream-compatible theme classes (spec §7.4).
   *
   * Per-emitter, not global. Two emitters created from `htmlEmitterWith` calls
   * with different prefixes produce different output independently.
   */
  readonly classPrefix?: string;
}

// Internal mutable token-tree node used while the engine drives the emitter.
// We never expose this shape; render() and toTokenStream() both freeze before
// returning anything to the outside world.
interface MutableScope {
  type: 'scope';
  scope?: string;
  children: TokenNode[];
}

class HtmlEmitter implements Emitter<string> {
  private readonly root: MutableScope = { type: 'scope', children: [] };
  private readonly stack: MutableScope[] = [this.root];

  constructor(private readonly classPrefix: string) {}

  startScope(scope: string): void {
    const node: MutableScope = { type: 'scope', scope, children: [] };
    this.peek().children.push(node);
    this.stack.push(node);
  }

  endScope(): void {
    // Guard so a misbehaving driver cannot pop the root sentinel.
    if (this.stack.length > 1) this.stack.pop();
  }

  addText(text: string): void {
    if (text.length === 0) return;
    this.peek().children.push({ type: 'text', text });
  }

  addSubLanguage(stream: TokenStream, language: string): void {
    // spec §5.6: the parent receives the typed TokenStream value, never the
    // child emitter object. We embed it as a 'sub-language' node and render
    // it later with a `language-<name>` wrapping span (matching upstream).
    this.peek().children.push({ type: 'sub-language', language, stream });
  }

  finalize(): void {
    while (this.stack.length > 1) this.stack.pop();
  }

  render(): string {
    // Single pass over the token tree producing an HTML string. The wrapping
    // root span is intentionally not emitted: callers wrap the output in
    // `<pre><code class="kn-language-foo">…</code></pre>` themselves.
    return renderChildren(this.root.children, this.classPrefix);
  }

  toTokenStream(): TokenStream {
    return freezeStream(this.root);
  }

  private peek(): MutableScope {
    // The constructor seeds the stack with `root`; endScope() guards against
    // popping below it. Stack is therefore never empty.
    return this.stack[this.stack.length - 1] as MutableScope;
  }
}

function renderNode(node: TokenNode, classPrefix: string): string {
  if (node.type === 'text') {
    return htmlEscape(node.text);
  }
  if (node.type === 'sub-language') {
    // spec §5.6 / Scout §5: sub-language wrapper uses the `language-<name>`
    // class with NO classPrefix. Existing themes target `.language-foo`.
    const className = toClassNames(`language:${node.language}`, classPrefix);
    const inner =
      node.stream.type === 'scope' ? renderChildren(node.stream.children, classPrefix) : '';
    return `<span class="${className}">${inner}</span>`;
  }
  // node.type === 'scope'
  const inner = renderChildren(node.children, classPrefix);
  if (node.scope === undefined) {
    // Root or pass-through scope without a CSS class. Upstream's
    // `emitsWrappingTags` returns false for these — no wrapping span.
    return inner;
  }
  return `<span class="${toClassNames(node.scope, classPrefix)}">${inner}</span>`;
}

function renderChildren(children: readonly TokenNode[], classPrefix: string): string {
  let out = '';
  for (const child of children) out += renderNode(child, classPrefix);
  return out;
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
  const out: TokenStream = Object.freeze({
    type: 'scope' as const,
    children: Object.freeze(children),
    ...(scope.scope !== undefined ? { scope: scope.scope } : {}),
  });
  return out;
}

/**
 * Build a configurable {@link EmitterFactory}. Pass `classPrefix` to bind a
 * prefix to the factory (spec §7.4). When bound, it wins over the engine's
 * `EmitterOptions.classPrefix`. When omitted, the factory honors the engine's
 * `EmitterOptions.classPrefix`, falling back to the `kn-` default if the engine
 * supplies an empty value.
 *
 * Per-factory, not global: two factories built with different prefixes produce
 * independent emitters.
 *
 * @example
 *   const factory = htmlEmitterWith({ classPrefix: 'hljs-' });
 *   createHighlighter({ emitter: factory });
 */
export function htmlEmitterWith(config: HtmlEmitterConfig = {}): EmitterFactory<string> {
  // `boundPrefix` is the explicit per-factory override (spec §7.4 + dispatch §C-2).
  // When undefined, fall back to the engine-supplied options.classPrefix at create()
  // time, which lets users keep the default `kn-` via createHighlighter while
  // still letting them switch to `hljs-` either at the engine level or at the
  // factory level.
  const boundPrefix: string | undefined = config.classPrefix;
  return Object.freeze({
    name: 'html',
    create(opts: EmitterOptions): Emitter<string> {
      // The bound prefix wins when supplied, even if it's an empty string —
      // that's an explicit author choice. Otherwise honor the engine's
      // EmitterOptions.classPrefix; if the engine didn't supply one (empty or
      // undefined), fall back to the `kn-` default per spec §7.4.
      const classPrefix =
        boundPrefix !== undefined
          ? boundPrefix
          : opts.classPrefix && opts.classPrefix.length > 0
            ? opts.classPrefix
            : DEFAULT_CLASS_PREFIX;
      return new HtmlEmitter(classPrefix);
    },
  });
}

/**
 * The default {@link EmitterFactory} — `kn-` class prefix unless the engine's
 * `EmitterOptions.classPrefix` says otherwise. Matches themes shipped in
 * `@kindly-note/themes-default`. spec §1.2 row `@kindly-note/emitters-html`.
 */
export const htmlEmitter: EmitterFactory<string> = htmlEmitterWith();
