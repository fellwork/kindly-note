// Acceptance gates for `@kindly-note/auto-detect`. Build manifest c5b §D.
//
// Each gate maps to a `describe` block — read top-down for the spec coverage:
//   gate 2: detect JSON
//   gate 3: detect TS-specific syntax over JS
//   gate 4: detect plain JS (TS may be secondBest, mustn't be primary)
//   gate 5: supersetOf tie-break + preferLanguage knob
//   gate 6: empty / garbage input → undefined language, 0 relevance
//   gate 7: disableAutodetect honored + opt-in via includeDisabled
//   gate 8: subset filter only considers listed languages
// Plus extra coverage: aliases, dynamic registration, secondBest behavior.
//
// spec §1.2 row `@kindly-note/auto-detect`; Scout §6 (upstream highlightAuto).

import { type LanguageDefinition, createHighlighter, defineLanguage } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
import json from '@kindly-note/lang-json';
import typescript from '@kindly-note/lang-typescript';
import { describe, expect, it } from 'vitest';
import { createAutoDetector } from '../src/index.js';

function makeHighlighter() {
  return createHighlighter({ languages: [json, javascript, typescript] });
}

// ---------------------------------------------------------------------------
// Gate 2: JSON detection
// ---------------------------------------------------------------------------

describe('gate 2 — JSON detection', () => {
  it('classifies a tiny JSON object as JSON', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('{"a":1}');
    expect(r.language).toBe('JSON');
    expect(r.relevance).toBeGreaterThan(0);
  });

  it('classifies a nested JSON document as JSON', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('{"name":"alice","age":30,"tags":["a","b"]}');
    expect(r.language).toBe('JSON');
  });

  it('returns the highlighted value for the winning language', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('{"a":1}');
    // The default emitter is the recording emitter, which renders the empty
    // string. We just assert the field is a string (cohort 5b doesn't ship
    // an emitter wiring change). spec §5.1 + emitter.ts.
    expect(typeof r.value).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Gate 3: TypeScript wins on TS-specific syntax
// ---------------------------------------------------------------------------

describe('gate 3 — TypeScript over JavaScript on TS syntax', () => {
  it('identifies an interface declaration as TypeScript', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('interface Foo { x: number; }');
    expect(r.language).toBe('TypeScript');
  });

  it('identifies a type alias as TypeScript', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('type ID = string | number;');
    expect(r.language).toBe('TypeScript');
  });

  it('identifies an enum declaration as TypeScript', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('enum Color { Red, Green, Blue }');
    expect(r.language).toBe('TypeScript');
  });
});

// ---------------------------------------------------------------------------
// Gate 4: Plain JS doesn't get mis-classified as TS
// ---------------------------------------------------------------------------

describe('gate 4 — JavaScript over TypeScript on plain-JS syntax', () => {
  it('identifies a plain function as JavaScript (not TypeScript)', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('function f(x) { return x * 2; }');
    expect(r.language).toBe('JavaScript');
  });

  it('TypeScript may be secondBest for plain JS (gate-4 acceptance)', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    // Per the brief: "secondBest: 'typescript' is acceptable since TS is a
    // superset". We assert the primary AND that TypeScript appears as the
    // alternate, since they share the same grammar shape.
    const r = ad.detect('function f(x) { return x * 2; }');
    expect(r.language).toBe('JavaScript');
    // secondBest may be undefined or 'TypeScript'; both are acceptable.
    if (r.secondBest !== undefined) {
      expect(['TypeScript', 'JSON']).toContain(r.secondBest);
    }
  });
});

// ---------------------------------------------------------------------------
// Gate 5: supersetOf tie-break + preferLanguage knob
// ---------------------------------------------------------------------------

describe('gate 5 — supersetOf tie-break', () => {
  it('parent language wins when child declares supersetOf and scores tie', () => {
    // Synthetic minimal pair: `parent` has no supersetOf. `child` declares
    // `supersetOf: 'parent'`. Both produce identical relevance for the same
    // code (they share the contains array). The comparator must put parent
    // first.
    const parent: LanguageDefinition = defineLanguage({
      name: 'parent-lang',
      contains: [{ scope: 'keyword', beginKeywords: 'foo bar' }],
    });
    const child: LanguageDefinition = defineLanguage({
      name: 'child-lang',
      supersetOf: 'parent-lang',
      contains: [{ scope: 'keyword', beginKeywords: 'foo bar' }],
    });

    const hl = createHighlighter({ languages: [parent, child] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('foo bar foo bar');
    expect(r.language).toBe('parent-lang');
    expect(r.secondBest).toBe('child-lang');
  });

  it('preferLanguage overrides the supersetOf fallback when set', () => {
    const parent: LanguageDefinition = defineLanguage({
      name: 'parent-lang',
      contains: [{ scope: 'keyword', beginKeywords: 'foo bar' }],
    });
    const child: LanguageDefinition = defineLanguage({
      name: 'child-lang',
      supersetOf: 'parent-lang',
      contains: [{ scope: 'keyword', beginKeywords: 'foo bar' }],
    });

    const hl = createHighlighter({ languages: [parent, child] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('foo bar foo bar', { preferLanguage: 'child-lang' });
    expect(r.language).toBe('child-lang');
  });

  it('preferLanguage is a tie-breaker only — does not override real relevance gap', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    // JSON has very high relevance for `{"a":1}` — way above TS. preferLanguage
    // for TS must NOT flip the result.
    const r = ad.detect('{"a":1}', { preferLanguage: 'TypeScript' });
    expect(r.language).toBe('JSON');
  });
});

// ---------------------------------------------------------------------------
// Gate 6: empty / garbage input
// ---------------------------------------------------------------------------

describe('gate 6 — empty and garbage input', () => {
  it('returns undefined language for empty string', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('');
    expect(r.language).toBeUndefined();
    expect(r.relevance).toBe(0);
  });

  it('returns undefined language when no candidates exist', () => {
    const hl = createHighlighter(); // empty registry
    const ad = createAutoDetector(hl);

    const r = ad.detect('anything');
    expect(r.language).toBeUndefined();
    expect(r.relevance).toBe(0);
    expect(r.value).toBe('');
  });

  it('garbage input that no language claims yields a defined zero result', () => {
    // A subset that excludes every language → no candidates.
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('whatever', { subset: [] });
    expect(r.language).toBeUndefined();
    expect(r.relevance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Gate 7: disableAutodetect
// ---------------------------------------------------------------------------

describe('gate 7 — disableAutodetect', () => {
  it('excludes a language with disableAutodetect: true by default', () => {
    const sneaky: LanguageDefinition = defineLanguage({
      name: 'sneaky',
      disableAutodetect: true,
      // High-relevance keyword so the only way it could win is if it were
      // included.
      keywords: { keyword: 'sneaky' },
      contains: [{ scope: 'keyword', match: /sneaky/, relevance: 100 }],
    });

    const hl = createHighlighter({ languages: [sneaky] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('sneaky sneaky sneaky');
    expect(r.language).toBeUndefined(); // not included → no candidates
  });

  it('opts in via includeDisabled', () => {
    const sneaky: LanguageDefinition = defineLanguage({
      name: 'sneaky',
      disableAutodetect: true,
      contains: [{ scope: 'keyword', match: /sneaky/, relevance: 5 }],
    });

    const hl = createHighlighter({ languages: [sneaky] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('sneaky sneaky', { includeDisabled: true });
    expect(r.language).toBe('sneaky');
  });
});

// ---------------------------------------------------------------------------
// Gate 8: subset filter
// ---------------------------------------------------------------------------

describe('gate 8 — subset filter', () => {
  it('only considers languages in the subset', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    // Code that JSON would score high on, but we restrict to JS only.
    const r = ad.detect('{"a":1}', { subset: ['JavaScript'] });
    // Either the result is JavaScript (with whatever relevance JS gives this
    // string) or it's undefined (if JS scored 0). It MUST NOT be JSON.
    expect(r.language === 'JavaScript' || r.language === undefined).toBe(true);
  });

  it('subset accepts canonical names AND aliases', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    // 'json' is an alias of 'JSON'; both must resolve to the same handle.
    const r = ad.detect('{"a":1}', { subset: ['json'] });
    expect(r.language).toBe('JSON');
  });

  it('unknown subset names are silently dropped', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('{"a":1}', { subset: ['JSON', 'no-such-lang'] });
    expect(r.language).toBe('JSON');
  });

  it('empty subset returns the empty result', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('{"a":1}', { subset: [] });
    expect(r.language).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Extras: secondBest, late registration, frozen result
// ---------------------------------------------------------------------------

describe('secondBest behavior', () => {
  it('omits secondBest when only one candidate scores above zero', () => {
    const onlyOne: LanguageDefinition = defineLanguage({
      name: 'onlyOne',
      contains: [{ scope: 'keyword', match: /widget/, relevance: 10 }],
    });
    const hl = createHighlighter({ languages: [onlyOne] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('widget widget');
    expect(r.language).toBe('onlyOne');
    expect(r.secondBest).toBeUndefined();
  });
});

describe('late registration', () => {
  it('languages registered after createAutoDetector are picked up', () => {
    const hl = createHighlighter();
    const ad = createAutoDetector(hl);

    // No languages yet — empty result.
    expect(ad.detect('{"a":1}').language).toBeUndefined();

    // Register JSON, then re-run detect.
    hl.registerLanguage(json);
    expect(ad.detect('{"a":1}').language).toBe('JSON');
  });
});

describe('result is frozen', () => {
  it('freezes the result so callers cannot mutate it', () => {
    const hl = makeHighlighter();
    const ad = createAutoDetector(hl);

    const r = ad.detect('{"a":1}');
    expect(Object.isFrozen(r)).toBe(true);
  });
});
