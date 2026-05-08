// Internal default emitter for v0. Records calls into a TokenStream and
// returns a minimal, tag-free string render suitable for snapshot tests.
//
// This is INTERNAL — subpath ../emitter.ts publishes the public emitter
// surface. The default HTML emitter lives in @kindly-note/emitters-html
// (later cohort). Cohort 1 ships this default so the engine has something
// to render with out of the box; the recording shape exactly mirrors the
// public TokenStream contract (spec section 5.2).

import type {
  Emitter,
  EmitterFactory,
  EmitterOptions,
  TokenNode,
  TokenStream,
} from '../emitter.js';

interface MutableScope {
  type: 'scope';
  scope?: string;
  children: TokenNode[];
}

class RecordingEmitter implements Emitter<string> {
  private readonly root: MutableScope = { type: 'scope', children: [] };
  private readonly stack: MutableScope[] = [this.root];

  constructor(private readonly classPrefix: string) {}

  startScope(scope: string): void {
    const node: MutableScope = { type: 'scope', scope, children: [] };
    this.peek().children.push(node);
    this.stack.push(node);
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
    return renderText(this.root);
  }

  toTokenStream(): TokenStream {
    return freezeStream(this.root);
  }

  private peek(): MutableScope {
    // The constructor seeds the stack with `root`; pop guards against
    // popping below it. So the stack is never empty.
    return this.stack[this.stack.length - 1] as MutableScope;
  }
}

function renderText(scope: MutableScope): string {
  let out = '';
  for (const child of scope.children) {
    if (child.type === 'text') out += child.text;
    else if (child.type === 'scope') out += renderText(child as MutableScope);
    else if (child.type === 'sub-language') out += renderText(child.stream as MutableScope);
  }
  return out;
}

function freezeStream(scope: MutableScope): TokenStream {
  const children: TokenNode[] = scope.children.map((c) => {
    if (c.type === 'scope') return freezeStream(c as MutableScope);
    if (c.type === 'sub-language') {
      return Object.freeze({
        type: 'sub-language' as const,
        language: c.language,
        stream: freezeStream(c.stream as MutableScope),
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
 * The default factory used by createHighlighter when no emitter is supplied.
 * Produces a minimal text render and a fully-typed TokenStream.
 */
export const defaultRecordingEmitter: EmitterFactory<string> = Object.freeze({
  name: 'kn-default-recording',
  create(opts: EmitterOptions): Emitter<string> {
    return new RecordingEmitter(opts.classPrefix);
  },
});
