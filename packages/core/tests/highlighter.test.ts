// End-to-end + compilation-timing tests.
// Acceptance test #4 (compilation timing) and a DOM-freeness smoke test
// (acceptance #5) live here.
import { describe, expect, it } from 'vitest';
import {
  type LanguageDefinition,
  type Mode,
  createHighlighter,
  defineLanguage,
} from '../src/index.js';

describe('end-to-end highlight (registers a tiny stub, runs the matcher)', () => {
  it('matches a single-char mode and produces a result', () => {
    const tiny = defineLanguage({
      name: 'tiny',
      contains: [{ scope: 'kw', begin: /a/ }],
    });
    const hl = createHighlighter({ languages: [tiny] });
    const r = hl.highlight('a', { language: 'tiny' });
    expect(r.language).toBe('tiny');
    expect(r.illegal).toBe(false);
    // The recording emitter renders just the literal text (no tags).
    expect(r.value).toBe('a');
    expect(r._tokenStream).toBeDefined();
    expect(r._tokenStream?.children.length).toBeGreaterThan(0);
  });

  it('keyword dictionary tokens are scoped', () => {
    const k = defineLanguage({
      name: 'k',
      contains: [],
      keywords: { keyword: ['if', 'else'] },
    });
    const hl = createHighlighter({ languages: [k] });
    const r = hl.highlight('if x else y', { language: 'k' });
    expect(r.language).toBe('k');
    // Stream root has children with scope='keyword' for matched lexemes.
    const stream = r._tokenStream;
    expect(stream).toBeDefined();
    const scoped = (stream?.children ?? []).filter(
      (c) => c.type === 'scope' && c.scope === 'keyword',
    );
    expect(scoped.length).toBe(2);
  });

  it('alias resolution looks up by alias and canonical name (case insensitive)', () => {
    const lang = defineLanguage({
      name: 'JavaScript',
      aliases: ['js', 'jsx'],
      contains: [],
    });
    const hl = createHighlighter({ languages: [lang] });
    expect(hl.getLanguage('JavaScript')).toBeDefined();
    expect(hl.getLanguage('javascript')).toBeDefined(); // lowercase
    expect(hl.getLanguage('js')).toBeDefined();
    expect(hl.getLanguage('JSX')).toBeDefined(); // alias case-insensitive
    expect(hl.getLanguage('python')).toBeUndefined();
  });

  it("unknown language under errorMode 'safe' returns an inert result", () => {
    const hl = createHighlighter({ languages: [] });
    const r = hl.highlight('hello', { language: 'unknown' });
    expect(r.illegal).toBe(false);
    expect(r.value).toBe('hello');
    expect(r.language).toBeUndefined();
  });

  it("unknown language under errorMode 'throw' throws", () => {
    const hl = createHighlighter({ languages: [], errorMode: 'throw' });
    expect(() => hl.highlight('hello', { language: 'unknown' })).toThrow(
      /Unknown language: "unknown"/,
    );
  });
});

describe('compilation timing (spec §9.1) — acceptance #4', () => {
  it('mutating the source LanguageDefinition AFTER register has no effect', () => {
    // Build a definition without freezing (cast around defineLanguage to
    // simulate a caller that handed us a mutable shape — for example, a
    // future serialized loader that returns a JSON.parse value).
    const def: LanguageDefinition<unknown> = {
      name: 'mut',
      contains: [{ scope: 'kw', begin: /a/, label: 'kw-a' }],
      keywords: { keyword: ['orig'] },
    };
    // We do NOT call defineLanguage here — to test that registerLanguage's
    // internal compileLanguage decoupling holds even on mutable inputs.
    const hl = createHighlighter();
    const handle = hl.registerLanguage(def);

    // Mutate the original.
    (def.contains as Mode[]).push({ scope: 'string', begin: /b/ });
    (def.keywords as Record<string, string[]>).keyword = ['changed'];

    // The compiled snapshot inside the handle is unaffected.
    expect(handle.compiled.root.contains).toHaveLength(1);
    // Highlight still uses the snapshot.
    const r = hl.highlight('orig changed', { language: 'mut' });
    expect(r.language).toBe('mut');
    // Stream confirms only `orig` was a keyword (the original snapshot's keyword set).
    const stream = r._tokenStream;
    const scoped = (stream?.children ?? []).filter(
      (c) => c.type === 'scope' && c.scope === 'keyword',
    );
    expect(scoped.length).toBe(1);
  });

  it('compileLanguage produces fresh-but-equal artifacts on repeated calls', () => {
    const def = defineLanguage({ name: 'x', contains: [] });
    const hl1 = createHighlighter({ languages: [def] });
    const hl2 = createHighlighter({ languages: [def] });
    const a = hl1.getLanguage('x')!.compiled;
    const b = hl2.getLanguage('x')!.compiled;
    expect(a).not.toBe(b);
    expect(a.name).toBe(b.name);
    expect(a.aliases).toEqual(b.aliases);
  });

  it('the compiled artifact is deep-frozen', () => {
    const lang = defineLanguage({
      name: 'z',
      contains: [{ scope: 'kw', begin: /a/ }],
    });
    const hl = createHighlighter({ languages: [lang] });
    const compiled = hl.getLanguage('z')!.compiled;
    expect(Object.isFrozen(compiled)).toBe(true);
    expect(Object.isFrozen(compiled.root)).toBe(true);
    expect(Object.isFrozen(compiled.root.contains)).toBe(true);
  });
});

describe('DOM-freeness smoke (acceptance #5)', () => {
  // spec §1.2: @kindly-note/core has zero DOM dependencies. Vitest runs in
  // 'node' env; if any core module imported `document` etc., this test
  // would never get to run.
  it('the test environment has no DOM globals', () => {
    expect(typeof (globalThis as unknown as { document?: unknown }).document).toBe('undefined');
    expect(typeof (globalThis as unknown as { window?: unknown }).window).toBe('undefined');
  });

  it('createHighlighter runs without DOM globals', () => {
    const hl = createHighlighter();
    expect(typeof hl.highlight).toBe('function');
    expect(hl.options.classPrefix).toBe('kn-'); // spec §0 #6
  });

  it('all public exports importable in node env', async () => {
    // Re-imported here to confirm side-effect-free top-level.
    const m = await import('../src/index.js');
    expect(typeof m.createHighlighter).toBe('function');
    expect(typeof m.defineLanguage).toBe('function');
    expect(typeof m.extendLanguage).toBe('function');
    expect(typeof m.definePlugin).toBe('function');
    expect(typeof m.defineEmitter).toBe('function');
    expect(typeof m.compileLanguage).toBe('function');
    expect(typeof m.regex).toBe('object');
    expect(typeof m.errors).toBe('object');
    expect(typeof m.VERSION).toBe('string');
  });
});
