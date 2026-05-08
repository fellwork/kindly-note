// Acceptance tests for the default `htmlEmitter` factory.
// Covers dispatch §C gates 1, 4, 5, 6, 7.

import type { TokenStream } from '@kindly-note/core';
import { describe, expect, it } from 'vitest';
import { htmlEmitter } from '../src/index.js';

function emitterOptions(overrides: Partial<{ classPrefix: string; language: string }> = {}) {
  return {
    classPrefix: overrides.classPrefix ?? 'kn-',
    language: overrides.language ?? 'json',
  };
}

describe('htmlEmitter — default factory (acceptance gate D-1)', () => {
  it('emits \'<span class="kn-keyword">class</span>\' for the documented one-scope case', () => {
    // dispatch §C-1: default prefix is `kn-`.
    const e = htmlEmitter.create(emitterOptions());
    e.startScope('keyword');
    e.addText('class');
    e.endScope();
    e.finalize();
    expect(e.render()).toBe('<span class="kn-keyword">class</span>');
  });

  it('reproduces spec §5.6 numbered call-trace output for `{"a":1}`', () => {
    // spec §5.6: highlight('json', '{"a":1}') with kn- prefix → exactly the
    // inline span sequence quoted in the spec.
    const e = htmlEmitter.create(emitterOptions());
    e.startScope('punctuation');
    e.addText('{');
    e.endScope();
    e.startScope('attr');
    e.addText('"a"');
    e.endScope();
    e.startScope('punctuation');
    e.addText(':');
    e.endScope();
    e.startScope('number');
    e.addText('1');
    e.endScope();
    e.startScope('punctuation');
    e.addText('}');
    e.endScope();
    e.finalize();
    expect(e.render()).toBe(
      '<span class="kn-punctuation">{</span>' +
        '<span class="kn-attr">&quot;a&quot;</span>' +
        '<span class="kn-punctuation">:</span>' +
        '<span class="kn-number">1</span>' +
        '<span class="kn-punctuation">}</span>',
    );
  });

  it('emits no wrapping span when the engine never starts a scope', () => {
    const e = htmlEmitter.create(emitterOptions());
    e.addText('hello');
    e.finalize();
    expect(e.render()).toBe('hello');
  });
});

describe('htmlEmitter — HTML escaping (acceptance gate D-4)', () => {
  it('escapes <script> in addText', () => {
    const e = htmlEmitter.create(emitterOptions());
    e.startScope('keyword');
    e.addText('<script>');
    e.endScope();
    e.finalize();
    const out = e.render();
    expect(out).toBe('<span class="kn-keyword">&lt;script&gt;</span>');
    // Spot-check: the only `<` characters in the output are the wrapping span
    // openers, never raw user text.
    expect(out.includes('<script')).toBe(false);
  });

  it('escapes the dispatch §D-4 worked string with no raw < or > surviving in text', () => {
    const e = htmlEmitter.create(emitterOptions());
    e.addText(`<a href="x" onclick='alert(\`x\`)'>`);
    e.finalize();
    const out = e.render();
    // Only the wrapping `<span>` openers — but there are none here because we
    // never opened a scope. So the entire output must be entity-escaped.
    expect(out).toBe('&lt;a href=&quot;x&quot; onclick=&#x27;alert(`x`)&#x27;&gt;');
    expect(out.includes('<')).toBe(false);
    expect(out.includes('>')).toBe(false);
  });
});

describe('htmlEmitter — sub-language boundary (acceptance gate D-5, D-6)', () => {
  it('renders a TokenStream value passed via addSubLanguage with a wrapping language- span', () => {
    // dispatch §C-5: addSubLanguage receives a TokenStream value, NOT an
    // emitter object. We fabricate a TokenStream representing what the engine
    // would have built for an inline JSON sub-language.
    const subStream: TokenStream = {
      type: 'scope',
      // No `scope` on the root: it's the sub-language root, the wrapping span
      // is added by renderNode's 'sub-language' branch.
      children: [
        { type: 'scope', scope: 'attr', children: [{ type: 'text', text: '"a"' }] },
        { type: 'text', text: ':' },
        { type: 'scope', scope: 'number', children: [{ type: 'text', text: '1' }] },
      ],
    };

    const e = htmlEmitter.create(emitterOptions());
    e.startScope('tag');
    e.addText('<style>');
    e.endScope();
    e.addSubLanguage(subStream, 'json');
    e.startScope('tag');
    e.addText('</style>');
    e.endScope();
    e.finalize();

    const out = e.render();
    expect(out).toBe(
      '<span class="kn-tag">&lt;style&gt;</span>' +
        '<span class="language-json">' +
        '<span class="kn-attr">&quot;a&quot;</span>' +
        ':' +
        '<span class="kn-number">1</span>' +
        '</span>' +
        '<span class="kn-tag">&lt;/style&gt;</span>',
    );
  });

  it("uses 'language-<name>' (no prefix) for the sub-language wrapper class", () => {
    // spec §7.4 / Scout §5: language: prefix on a scope name strips into
    // language- with no `kn-` / `hljs-` prefix on the wrapper. This matches
    // upstream theme conventions and is what dispatch §C-5 calls out.
    const subStream: TokenStream = {
      type: 'scope',
      children: [{ type: 'text', text: 'hello' }],
    };
    const e = htmlEmitter.create(emitterOptions());
    e.addSubLanguage(subStream, 'json');
    e.finalize();
    const out = e.render();
    expect(out).toBe('<span class="language-json">hello</span>');
    // Defensive: no `kn-json` or `hljs-json` should ever appear here.
    expect(out.includes('kn-json')).toBe(false);
    expect(out.includes('hljs-json')).toBe(false);
  });
});

describe('htmlEmitter — toTokenStream and finalize semantics', () => {
  it('finalize closes any unclosed scopes', () => {
    // Defensive: the engine SHOULD call endScope for every startScope, but
    // finalize() must be a safety net.
    const e = htmlEmitter.create(emitterOptions());
    e.startScope('outer');
    e.startScope('inner');
    e.addText('text');
    // No endScope calls.
    e.finalize();
    expect(e.render()).toBe('<span class="kn-outer"><span class="kn-inner">text</span></span>');
  });

  it('toTokenStream returns a frozen TokenStream', () => {
    const e = htmlEmitter.create(emitterOptions());
    e.startScope('keyword');
    e.addText('class');
    e.endScope();
    e.finalize();

    const stream = e.toTokenStream();
    expect(stream.type).toBe('scope');
    expect(Object.isFrozen(stream)).toBe(true);
    expect(Object.isFrozen(stream.children)).toBe(true);
    expect(stream.children).toHaveLength(1);
  });

  it('multiple emitters from the same factory are independent', () => {
    const a = htmlEmitter.create(emitterOptions());
    const b = htmlEmitter.create(emitterOptions());
    a.addText('A');
    a.finalize();
    b.addText('B');
    b.finalize();
    expect(a.render()).toBe('A');
    expect(b.render()).toBe('B');
  });
});
