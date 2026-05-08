// Acceptance tests for `adaptLegacyPlugin`.
//
// Covers dispatch §D acceptance gates:
//   D-2: each of the 6 hooks fires in the right modern phase.
//   D-3: mutation faithfulness (`before:highlight` rewrites code).
//   D-4: short-circuit faithfulness (`before:highlight` sets ctx.result).
//   D-5: `after:highlight` mutation (rewrite result.value).
//   D-7: mutation quarantined inside the adapter; modern protocol pure.
//
// spec §3 (legacy-plugin adapter design) is the normative source. The 6-hook
// mapping table is in spec §3.3.

import { createHighlighter, defineLanguage } from '@kindly-note/core';
import type { HighlightResult, LanguageDefinition } from '@kindly-note/core';
import { describe, expect, it, vi } from 'vitest';
import { adaptLegacyPlugin } from '../src/index.js';
import type {
  LegacyAfterHighlightBlockData,
  LegacyAfterHighlightElementData,
  LegacyBeforeHighlightBlockData,
  LegacyBeforeHighlightElementData,
  LegacyHLJSPlugin,
} from '../src/index.js';

// A trivial language used as the engine target. The matcher's behavior is
// covered by core's own test suite — what we care about here is the plugin
// pipeline plumbing. spec §3.5 registers a real language too; the worked
// example test in `line-numbers.test.ts` does that end-to-end.
function makeJsonLikeLanguage(): LanguageDefinition {
  return defineLanguage({
    name: 'mini',
    aliases: ['m'],
    contains: [],
  });
}

// ---------------------------------------------------------------------------
// Naming + identity
// ---------------------------------------------------------------------------

describe('adaptLegacyPlugin — naming + identity (spec §3.2)', () => {
  it('returns a Plugin whose `name` is `legacy:<name>`', () => {
    const adapted = adaptLegacyPlugin({}, 'my-plugin');
    expect(adapted.name).toBe('legacy:my-plugin');
  });

  it("defaults the name to 'legacy:legacy' when no name is provided", () => {
    const adapted = adaptLegacyPlugin({});
    expect(adapted.name).toBe('legacy:legacy');
  });

  it("declares apiVersion '1' so the engine accepts it", () => {
    const adapted = adaptLegacyPlugin({});
    expect(adapted.apiVersion).toBe('1');
  });

  it('per-phase tree-shake: only declares the modern phases the legacy plugin actually uses', () => {
    // spec §2.7: an adapter for a legacy plugin that only has
    // `after:highlight` MUST NOT declare any other modern phase. The engine
    // skips undefined hooks at zero cost.
    const onlyAfter = adaptLegacyPlugin({ 'after:highlight': () => {} });
    expect(onlyAfter.transformResult).toBeTypeOf('function');
    expect(onlyAfter.transformCode).toBeUndefined();
    expect(onlyAfter.shortCircuit).toBeUndefined();
    expect(onlyAfter.beforeElement).toBeUndefined();
    expect(onlyAfter.afterElement).toBeUndefined();
  });

  it('a wholly-empty legacy plugin produces a wholly-empty modern Plugin (no phase hooks)', () => {
    const empty = adaptLegacyPlugin({});
    expect(empty.transformCode).toBeUndefined();
    expect(empty.shortCircuit).toBeUndefined();
    expect(empty.transformResult).toBeUndefined();
    expect(empty.beforeElement).toBeUndefined();
    expect(empty.afterElement).toBeUndefined();
  });

  it('does not mutate the caller-supplied legacy plugin object (clone-on-adapt)', () => {
    // spec §3.4: the adapter mirrors upstream upgradePluginAPI but MUST NOT
    // mutate the user's original plugin. Verify by passing a deprecated-only
    // plugin and confirming `before:highlightElement` is not added to the
    // user's copy.
    const legacy: LegacyHLJSPlugin = {
      'before:highlightBlock': () => {},
    };
    const before = Object.keys(legacy).sort();
    adaptLegacyPlugin(legacy);
    expect(Object.keys(legacy).sort()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// D-2: each hook fires in the right modern phase
// ---------------------------------------------------------------------------

describe('hook → modern-phase mapping (dispatch §D-2 — spec §3.3 table)', () => {
  it('before:highlight → transformCode + shortCircuit', () => {
    const fired: string[] = [];
    const legacy: LegacyHLJSPlugin = {
      'before:highlight': () => fired.push('before:highlight'),
    };
    const adapted = adaptLegacyPlugin(legacy);
    expect(adapted.transformCode).toBeTypeOf('function');
    expect(adapted.shortCircuit).toBeTypeOf('function');
    // Run end-to-end via the engine; legacy hook must fire exactly once
    // (transformCode invokes it; shortCircuit reads the stashed result).
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adapted],
    });
    hl.highlight('x', { language: 'mini' });
    expect(fired).toEqual(['before:highlight']);
  });

  it('after:highlight → transformResult', () => {
    const fired: string[] = [];
    const legacy: LegacyHLJSPlugin = {
      'after:highlight': () => fired.push('after:highlight'),
    };
    const adapted = adaptLegacyPlugin(legacy);
    expect(adapted.transformResult).toBeTypeOf('function');
    expect(adapted.transformCode).toBeUndefined();
    expect(adapted.shortCircuit).toBeUndefined();
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adapted],
    });
    hl.highlight('x', { language: 'mini' });
    expect(fired).toEqual(['after:highlight']);
  });

  it('before:highlightElement → beforeElement', () => {
    const adapted = adaptLegacyPlugin({
      'before:highlightElement': () => {},
    });
    expect(adapted.beforeElement).toBeTypeOf('function');
    expect(adapted.afterElement).toBeUndefined();
  });

  it('after:highlightElement → afterElement', () => {
    const adapted = adaptLegacyPlugin({
      'after:highlightElement': () => {},
    });
    expect(adapted.afterElement).toBeTypeOf('function');
    expect(adapted.beforeElement).toBeUndefined();
  });

  it('before:highlightBlock (deprecated) → beforeElement (alias) — spec §3.3 row 5', () => {
    const fired: LegacyBeforeHighlightBlockData[] = [];
    const adapted = adaptLegacyPlugin({
      'before:highlightBlock': (data) => fired.push(data),
    });
    expect(adapted.beforeElement).toBeTypeOf('function');
    // Drive the modern beforeElement hook with a fake element and confirm
    // the deprecated hook receives `{ block, language }` per upstream
    // upgradePluginAPI semantics.
    const fakeEl = { tagName: 'PRE' } as unknown as Element;
    const ctx = makeFakeCtx();
    if (adapted.beforeElement === undefined) throw new Error('expected beforeElement');
    adapted.beforeElement({ el: fakeEl, language: 'js' }, ctx);
    expect(fired).toHaveLength(1);
    expect(fired[0]?.block).toBe(fakeEl);
    expect(fired[0]?.language).toBe('js');
  });

  it('after:highlightBlock (deprecated) → afterElement (alias) — spec §3.3 row 6', () => {
    const fired: LegacyAfterHighlightBlockData[] = [];
    const adapted = adaptLegacyPlugin({
      'after:highlightBlock': (data) => fired.push(data),
    });
    expect(adapted.afterElement).toBeTypeOf('function');
    const fakeEl = { tagName: 'PRE' } as unknown as Element;
    const fakeResult: HighlightResult = {
      value: '<span>x</span>',
      relevance: 0,
      illegal: false,
    };
    const ctx = makeFakeCtx();
    if (adapted.afterElement === undefined) throw new Error('expected afterElement');
    adapted.afterElement({ el: fakeEl, result: fakeResult, text: 'x' }, ctx);
    expect(fired).toHaveLength(1);
    expect(fired[0]?.block).toBe(fakeEl);
    expect(fired[0]?.text).toBe('x');
    expect(fired[0]?.result.value).toBe('<span>x</span>');
  });

  it('deprecated alias is not installed when the modern element hook is already set (upstream upgradePluginAPI)', () => {
    // spec §3.4 (mirror of upstream): if both `before:highlightBlock` AND
    // `before:highlightElement` are defined, the modern one wins; the
    // deprecated one is NOT also fired.
    const blockFired = vi.fn();
    const elementFired = vi.fn();
    const adapted = adaptLegacyPlugin({
      'before:highlightBlock': blockFired,
      'before:highlightElement': elementFired,
    });
    const ctx = makeFakeCtx();
    if (adapted.beforeElement === undefined) throw new Error('expected beforeElement');
    adapted.beforeElement({ el: {} as Element, language: 'js' }, ctx);
    expect(elementFired).toHaveBeenCalledTimes(1);
    expect(blockFired).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// D-3: mutation faithfulness — code rewrite
// ---------------------------------------------------------------------------

describe('before:highlight mutation faithfulness (dispatch §D-3)', () => {
  it("a `before:highlight` plugin that sets `context.code = 'replaced'` mutates the engine's input", () => {
    let observedCode: string | undefined;
    const replacingLegacy: LegacyHLJSPlugin = {
      'before:highlight': (ctx) => {
        ctx.code = 'replaced';
      },
    };
    // A second plugin observes what `transformCode` produced — i.e. the
    // mutated input the engine will pass to `_highlight()`.
    const observerPlugin = adaptLegacyPlugin({
      'before:highlight': (ctx) => {
        observedCode = ctx.code;
      },
    });

    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adaptLegacyPlugin(replacingLegacy), observerPlugin],
    });
    const result = hl.highlight('original', { language: 'mini' });

    // The replacement is observable to subsequent plugins…
    expect(observedCode).toBe('replaced');
    // …and the engine highlighted the replaced text (its `result.code`
    // surfaces what the engine actually saw).
    expect(result.code).toBe('replaced');
  });

  it('a `before:highlight` plugin can mutate `context.language` to redirect to another language', () => {
    // Register two languages so we can prove the redirect works.
    const a = defineLanguage({ name: 'a', contains: [] });
    const b = defineLanguage({ name: 'b', contains: [] });
    const redirect = adaptLegacyPlugin({
      'before:highlight': (ctx) => {
        ctx.language = 'b';
      },
    });
    const hl = createHighlighter({ languages: [a, b], plugins: [redirect] });
    const out = hl.highlight('xyz', { language: 'a' });
    expect(out.language).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// D-4: short-circuit faithfulness
// ---------------------------------------------------------------------------

describe('before:highlight short-circuit (dispatch §D-4 — spec §3.3 row 1)', () => {
  it('setting `context.result` short-circuits the engine; the result is what the plugin set', () => {
    const shortResult: HighlightResult = {
      value: 'short',
      relevance: 0,
      illegal: false,
      language: 'mini',
    };
    const shortCircuitingLegacy: LegacyHLJSPlugin = {
      'before:highlight': (ctx) => {
        ctx.result = shortResult;
      },
    };
    // A second plugin's `before:highlight` runs in transformCode only —
    // shortCircuit phase happens AFTER all transformCode phases. Spec §2.3
    // step order. The second plugin sees the mutated code/language but
    // cannot prevent the short-circuit.
    let secondRan = false;
    const secondLegacy: LegacyHLJSPlugin = {
      'before:highlight': () => {
        secondRan = true;
      },
    };

    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adaptLegacyPlugin(shortCircuitingLegacy), adaptLegacyPlugin(secondLegacy)],
    });
    const out = hl.highlight('whatever', { language: 'mini' });
    // Engine returns the shorted result.
    expect(out.value).toBe('short');
    // Second transformCode still ran (engine fires all transformCode phases
    // before any shortCircuit; spec §2.3 step 2-3).
    expect(secondRan).toBe(true);
  });

  it('NOT setting `context.result` lets the engine run normally', () => {
    const noopLegacy: LegacyHLJSPlugin = {
      'before:highlight': () => {
        /* no-op */
      },
    };
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adaptLegacyPlugin(noopLegacy)],
    });
    const out = hl.highlight('hello', { language: 'mini' });
    // No shorting — the engine produced its normal result.
    expect(out.value).not.toBe('short');
  });
});

// ---------------------------------------------------------------------------
// D-5: after:highlight mutation
// ---------------------------------------------------------------------------

describe('after:highlight mutation (dispatch §D-5 — spec §3.3 row 2)', () => {
  it('a plugin that rewrites `result.value` produces the mutated value in the engine return', () => {
    const rewrite: LegacyHLJSPlugin = {
      'after:highlight': (result) => {
        // Cast to mutable type to reflect upstream's semantics: the legacy
        // plugin contract says `result.value` is writable.
        (result as { value: string }).value = `wrapped(${result.value})`;
      },
    };
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adaptLegacyPlugin(rewrite)],
    });
    const out = hl.highlight('abc', { language: 'mini' });
    expect(out.value).toMatch(/^wrapped\(/);
  });

  it("multiple `after:highlight` plugins chain — plugin N sees plugin N-1's mutation", () => {
    const a = adaptLegacyPlugin({
      'after:highlight': (r) => {
        (r as { value: string }).value = `a(${r.value})`;
      },
    });
    const b = adaptLegacyPlugin({
      'after:highlight': (r) => {
        (r as { value: string }).value = `b(${r.value})`;
      },
    });
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [a, b],
    });
    const out = hl.highlight('x', { language: 'mini' });
    // a runs first, then b sees `a(...)` and wraps it again.
    expect(out.value).toMatch(/^b\(a\(/);
  });
});

// ---------------------------------------------------------------------------
// D-7: mutation quarantine — modern protocol stays pure
// ---------------------------------------------------------------------------

describe('mutation quarantine (dispatch §D-7 — spec §3 goal)', () => {
  it('`transformResult` returns a new HighlightResult object — does not mutate its input', () => {
    const adapted = adaptLegacyPlugin({
      'after:highlight': (result) => {
        (result as { value: string }).value = 'mutated';
      },
    });
    if (adapted.transformResult === undefined) throw new Error('expected transformResult');

    // Construct a frozen original — any in-place mutation by the adapter
    // would throw or fail-silently in strict mode. The contract is that the
    // adapter NEVER mutates its input, only returns a new object.
    const original: HighlightResult = Object.freeze({
      value: 'original',
      relevance: 1,
      illegal: false,
    });
    const ctx = makeFakeCtx();
    const next = adapted.transformResult(original, ctx);

    // The original is untouched.
    expect(original.value).toBe('original');
    // A new object surfaced.
    expect(next).not.toBe(original);
    // The legacy plugin's mutation IS reflected in the new object.
    expect(next.value).toBe('mutated');
  });

  it('`transformCode` returns a new CodeInput — does not mutate its input', () => {
    const adapted = adaptLegacyPlugin({
      'before:highlight': (ctx) => {
        ctx.code = 'changed';
      },
    });
    if (adapted.transformCode === undefined) throw new Error('expected transformCode');

    const original = Object.freeze({ code: 'hi', language: 'mini', ignoreIllegals: false });
    const ctx = makeFakeCtx();
    const next = adapted.transformCode(original, ctx);

    expect(original.code).toBe('hi');
    expect(next).not.toBe(original);
    expect(next.code).toBe('changed');
  });

  it("`afterElement` shall not let legacy mutations of `result.value` leak back into the engine's HighlightResult", () => {
    // Construct an ElementOutput whose `result` is frozen. The adapter must
    // hand the legacy plugin a shallow COPY so legacy mutations don't throw
    // (and don't escape upward).
    const adapted = adaptLegacyPlugin({
      'after:highlightElement': (data) => {
        // Legacy plugin mutates result.value — this is what they expect.
        (data.result as { value: string }).value = 'leaked';
      },
    });
    if (adapted.afterElement === undefined) throw new Error('expected afterElement');

    const frozenResult: HighlightResult = Object.freeze({
      value: 'engine',
      relevance: 0,
      illegal: false,
    });
    const ctx = makeFakeCtx();
    expect(() => {
      if (adapted.afterElement === undefined) throw new Error('unreachable');
      adapted.afterElement({ el: {} as Element, result: frozenResult, text: 't' }, ctx);
    }).not.toThrow();
    // Engine's view of result is untouched.
    expect(frozenResult.value).toBe('engine');
  });
});

// ---------------------------------------------------------------------------
// Error isolation — confirm errorMode interaction with the adapter
// ---------------------------------------------------------------------------

describe('error isolation (spec §2.4 + §3 adapter)', () => {
  it('safe-mode (default): a throwing legacy hook does not crash the highlight call', () => {
    const adapted = adaptLegacyPlugin({
      'before:highlight': () => {
        throw new Error('kaboom');
      },
    });
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adapted],
    });
    expect(() => hl.highlight('x', { language: 'mini' })).not.toThrow();
  });

  it('throw-mode: a throwing legacy hook surfaces a PluginError naming the adapter', () => {
    const adapted = adaptLegacyPlugin(
      {
        'before:highlight': () => {
          throw new Error('kaboom');
        },
      },
      'throwy',
    );
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adapted],
      errorMode: 'throw',
    });
    expect(() => hl.highlight('x', { language: 'mini' })).toThrow(/legacy:throwy/);
  });

  it("safe-mode after a transformCode throw: the adapter's shortCircuit returns undefined (no stale state)", () => {
    // If transformCode throws, ctx.state never sees the SHORT_CIRCUIT slot.
    // shortCircuit must NOT then conjure a result from thin air.
    const adapted = adaptLegacyPlugin({
      'before:highlight': () => {
        throw new Error('kaboom');
      },
    });
    const hl = createHighlighter({
      languages: [makeJsonLikeLanguage()],
      plugins: [adapted],
    });
    const out = hl.highlight('hi', { language: 'mini' });
    // Engine ran normally; the throwing plugin was isolated.
    expect(out.code).toBe('hi');
  });
});

// ---------------------------------------------------------------------------
// Element hooks — beforeElement / afterElement direct unit tests
// ---------------------------------------------------------------------------

describe('beforeElement / afterElement (spec §3.3 rows 3-4)', () => {
  it('beforeElement passes a mutable shim and feeds back the language mutation', () => {
    const adapted = adaptLegacyPlugin({
      'before:highlightElement': (data: LegacyBeforeHighlightElementData) => {
        data.language = 'python';
      },
    });
    if (adapted.beforeElement === undefined) throw new Error('expected beforeElement');
    const ctx = makeFakeCtx();
    const fakeEl = { tagName: 'PRE' } as unknown as Element;
    const next = adapted.beforeElement({ el: fakeEl, language: 'javascript' }, ctx);
    expect(next.el).toBe(fakeEl);
    expect(next.language).toBe('python');
  });

  it('afterElement returns void and passes a shallow-copy `result`', () => {
    let observed: LegacyAfterHighlightElementData | undefined;
    const adapted = adaptLegacyPlugin({
      'after:highlightElement': (data) => {
        observed = data;
      },
    });
    if (adapted.afterElement === undefined) throw new Error('expected afterElement');
    const fakeEl = { tagName: 'PRE' } as unknown as Element;
    const result: HighlightResult = { value: 'v', relevance: 1, illegal: false };
    const ctx = makeFakeCtx();
    const ret = adapted.afterElement({ el: fakeEl, result, text: 'src' }, ctx);
    expect(ret).toBeUndefined();
    expect(observed).toBeDefined();
    expect(observed?.el).toBe(fakeEl);
    expect(observed?.text).toBe('src');
    // Shallow copy: same field values, different reference.
    expect(observed?.result).not.toBe(result);
    expect(observed?.result.value).toBe('v');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeCtx() {
  return {
    highlighter: {
      getLanguage: () => undefined,
      listLanguages: () => [],
      options: {
        classPrefix: 'kn-',
        errorMode: 'safe' as const,
        ignoreUnescapedHTML: true,
        cssSelector: 'pre code',
      },
    },
    state: new Map<string, unknown>(),
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}
