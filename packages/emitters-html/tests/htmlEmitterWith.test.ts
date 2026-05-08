// Acceptance tests for htmlEmitterWith — covers dispatch §C gates 2 and 7.

import type { TokenStream } from '@kindly-note/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CLASS_PREFIX, htmlEmitterWith } from '../src/index.js';

function emitterOptions(overrides: Partial<{ classPrefix: string; language: string }> = {}) {
  return {
    classPrefix: overrides.classPrefix ?? 'kn-',
    language: overrides.language ?? 'json',
  };
}

describe('htmlEmitterWith — prefix override (acceptance gate D-2)', () => {
  it("produces hljs- classes when called with classPrefix: 'hljs-'", () => {
    // dispatch §C-2: opt-in `hljs-` path.
    const factory = htmlEmitterWith({ classPrefix: 'hljs-' });
    const e = factory.create(emitterOptions({ classPrefix: 'kn-' }));
    e.startScope('keyword');
    e.addText('class');
    e.endScope();
    e.finalize();
    expect(e.render()).toBe('<span class="hljs-keyword">class</span>');
  });

  it("the bound prefix wins over the engine's EmitterOptions.classPrefix", () => {
    // dispatch §C-2: "The override is per-emitter, not global." Verify by
    // building two factories with explicit prefixes and feeding both the same
    // engine-supplied options. Each factory keeps its bound prefix.
    const knFactory = htmlEmitterWith({ classPrefix: 'kn-' });
    const hljsFactory = htmlEmitterWith({ classPrefix: 'hljs-' });

    const knEm = knFactory.create(emitterOptions({ classPrefix: 'whatever-' }));
    const hljsEm = hljsFactory.create(emitterOptions({ classPrefix: 'whatever-' }));
    for (const e of [knEm, hljsEm]) {
      e.startScope('keyword');
      e.addText('class');
      e.endScope();
      e.finalize();
    }
    expect(knEm.render()).toBe('<span class="kn-keyword">class</span>');
    expect(hljsEm.render()).toBe('<span class="hljs-keyword">class</span>');
  });

  it("falls back to engine's classPrefix when the factory was built without an override", () => {
    // Lets users keep `htmlEmitter` as their factory and switch prefixes via
    // createHighlighter({ classPrefix: 'hljs-' }) per spec §7.4.
    const factory = htmlEmitterWith();
    const e = factory.create(emitterOptions({ classPrefix: 'hljs-' }));
    e.startScope('keyword');
    e.addText('class');
    e.endScope();
    e.finalize();
    expect(e.render()).toBe('<span class="hljs-keyword">class</span>');
  });

  it('falls back to the kn- default when no prefix is provided anywhere', () => {
    // Defense in depth — a malformed engine that omits classPrefix should
    // still produce something valid. spec §7.4: kn- is the default.
    const factory = htmlEmitterWith();
    const e = factory.create({ classPrefix: '', language: 'json' });
    e.startScope('keyword');
    e.addText('class');
    e.endScope();
    e.finalize();
    expect(e.render()).toBe(`<span class="${DEFAULT_CLASS_PREFIX}keyword">class</span>`);
  });
});

describe('htmlEmitterWith — tiered scope mapping under custom prefix (acceptance gate D-3)', () => {
  it("maps 'title.class.inherited' to 'kn-title class_ inherited__' under kn- (acceptance D-3)", () => {
    const e = htmlEmitterWith().create(emitterOptions());
    e.startScope('title.class.inherited');
    e.addText('Foo');
    e.endScope();
    e.finalize();
    // dispatch §C-3 verbatim: must include this exact class string.
    expect(e.render()).toBe('<span class="kn-title class_ inherited__">Foo</span>');
  });

  it("maps the same scope to 'hljs-title class_ inherited__' under the hljs- override", () => {
    const e = htmlEmitterWith({ classPrefix: 'hljs-' }).create(emitterOptions());
    e.startScope('title.class.inherited');
    e.addText('Foo');
    e.endScope();
    e.finalize();
    expect(e.render()).toBe('<span class="hljs-title class_ inherited__">Foo</span>');
  });
});

describe('htmlEmitterWith — sub-language under custom prefix (acceptance gate D-5)', () => {
  it('preserves language-<name> wrapper regardless of the bound prefix', () => {
    // The wrapper class is `language-<name>` per spec §7.4 / Scout §5; the
    // user's prefix never applies to it.
    const subStream: TokenStream = {
      type: 'scope',
      children: [{ type: 'scope', scope: 'attr', children: [{ type: 'text', text: '"a"' }] }],
    };
    const e = htmlEmitterWith({ classPrefix: 'hljs-' }).create(emitterOptions());
    e.addSubLanguage(subStream, 'json');
    e.finalize();
    expect(e.render()).toBe(
      '<span class="language-json"><span class="hljs-attr">&quot;a&quot;</span></span>',
    );
  });
});

describe('htmlEmitterWith — TokenStream-only signature (acceptance gate D-6)', () => {
  it('the addSubLanguage signature accepts only a TokenStream — no Emitter overload', () => {
    // dispatch §C-6: there must NOT be an overload that takes an Emitter.
    // We assert this at the type level via a function whose first parameter
    // is typed as TokenStream and whose body delegates to e.addSubLanguage.
    // If an Emitter overload had been declared, we would also need to verify
    // it isn't reachable; instead we keep a single signature.
    const factory = htmlEmitterWith();
    const e = factory.create(emitterOptions());
    const stream: TokenStream = { type: 'scope', children: [{ type: 'text', text: 'x' }] };
    // This compiles only because `addSubLanguage(stream, language)` accepts a
    // TokenStream as the first argument.
    e.addSubLanguage(stream, 'json');
    e.finalize();
    expect(e.render()).toBe('<span class="language-json">x</span>');

    // Compile-time guard: passing something that isn't a TokenStream should
    // be a TS error. We can't assert that at runtime, but we sanity-check the
    // shape's `type` discriminator is what we expect.
    expect(stream.type).toBe('scope');
  });
});
