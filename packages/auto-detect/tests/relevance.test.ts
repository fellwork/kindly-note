// Unit tests for the per-language scoring + comparator. Build manifest c5b §D.
//
// These tests stay below the integration line — they exercise `scoreLanguage`
// and `compareScores` directly against synthetic LanguageDefinitions, so we
// can pin numeric expectations without coupling to JS/TS/JSON behavior.

import {
  type Highlighter,
  type LanguageDefinition,
  type RegisteredLanguage,
  createHighlighter,
  defineLanguage,
} from '@kindly-note/core';
import { describe, expect, it } from 'vitest';
import { compareScores, scoreLanguage } from '../src/relevance.js';

function makeHandle(hl: Highlighter, name: string): RegisteredLanguage {
  const h = hl.getLanguage(name);
  if (h === undefined) throw new Error(`no such language: ${name}`);
  return h;
}

describe('scoreLanguage', () => {
  it('returns the highlight relevance for a clean match', () => {
    const lang: LanguageDefinition = defineLanguage({
      name: 'kw',
      contains: [{ scope: 'keyword', match: /widget/, relevance: 5 }],
    });
    const hl = createHighlighter({ languages: [lang] });
    const handle = makeHandle(hl, 'kw');

    const score = scoreLanguage(hl, 'widget widget', handle);
    expect(score.name).toBe('kw');
    expect(score.relevance).toBeGreaterThan(0);
  });

  it('returns 0 when the parser hits an illegal rule', () => {
    // `illegal: '\\S'` rejects any non-whitespace at the top level.
    const lang: LanguageDefinition = defineLanguage({
      name: 'strict',
      contains: [],
      illegal: '\\S',
    });
    const hl = createHighlighter({ languages: [lang] });
    const handle = makeHandle(hl, 'strict');

    const score = scoreLanguage(hl, 'this is not strict', handle);
    expect(score.relevance).toBe(0);
  });

  it('produces a frozen score record', () => {
    const lang: LanguageDefinition = defineLanguage({
      name: 'kw',
      contains: [{ scope: 'keyword', match: /widget/, relevance: 1 }],
    });
    const hl = createHighlighter({ languages: [lang] });
    const handle = makeHandle(hl, 'kw');

    const score = scoreLanguage(hl, 'widget', handle);
    expect(Object.isFrozen(score)).toBe(true);
  });
});

describe('compareScores', () => {
  // Three synthetic languages so we can assemble pairs deterministically.
  const parent: LanguageDefinition = defineLanguage({
    name: 'parent',
    contains: [{ scope: 'keyword', match: /foo/, relevance: 1 }],
  });
  const child: LanguageDefinition = defineLanguage({
    name: 'child',
    supersetOf: 'parent',
    contains: [{ scope: 'keyword', match: /foo/, relevance: 1 }],
  });
  const sibling: LanguageDefinition = defineLanguage({
    name: 'sibling',
    contains: [{ scope: 'keyword', match: /foo/, relevance: 1 }],
  });
  const hl = createHighlighter({ languages: [parent, child, sibling] });

  function s(name: string, relevance: number) {
    const handle = makeHandle(hl, name);
    return { name, relevance, result: hl.highlight('foo', { language: name }), handle };
  }

  it('higher relevance sorts first', () => {
    const a = s('parent', 5);
    const b = s('child', 2);
    expect(compareScores(a, b)).toBeLessThan(0); // a before b
    expect(compareScores(b, a)).toBeGreaterThan(0);
  });

  it('on tie, the parent (no supersetOf) wins over the child', () => {
    const a = s('child', 1);
    const b = s('parent', 1);
    // a (child) declares supersetOf=parent so it should sort AFTER b (parent).
    expect(compareScores(a, b)).toBeGreaterThan(0);
    expect(compareScores(b, a)).toBeLessThan(0);
  });

  it('on tie between two unrelated languages, returns 0', () => {
    const a = s('parent', 1);
    const b = s('sibling', 1);
    expect(compareScores(a, b)).toBe(0);
  });

  it('preferLanguage flips a tied comparison', () => {
    const a = s('child', 1);
    const b = s('parent', 1);
    expect(compareScores(a, b, 'child')).toBeLessThan(0);
    expect(compareScores(b, a, 'child')).toBeGreaterThan(0);
  });

  it('preferLanguage does not flip a non-tied comparison', () => {
    const a = s('child', 1);
    const b = s('parent', 5);
    expect(compareScores(a, b, 'child')).toBeGreaterThan(0); // b still wins
  });

  it('case-insensitive supersetOf match', () => {
    const upper: LanguageDefinition = defineLanguage({
      name: 'UpperParent',
      contains: [{ scope: 'keyword', match: /foo/, relevance: 1 }],
    });
    const lower: LanguageDefinition = defineLanguage({
      name: 'lowerchild',
      supersetOf: 'upperparent', // lowercase
      contains: [{ scope: 'keyword', match: /foo/, relevance: 1 }],
    });
    const hl2 = createHighlighter({ languages: [upper, lower] });

    const a = {
      name: 'lowerchild',
      relevance: 1,
      result: hl2.highlight('foo', { language: 'lowerchild' }),
      handle: makeHandle(hl2, 'lowerchild'),
    };
    const b = {
      name: 'UpperParent',
      relevance: 1,
      result: hl2.highlight('foo', { language: 'UpperParent' }),
      handle: makeHandle(hl2, 'UpperParent'),
    };
    expect(compareScores(a, b)).toBeGreaterThan(0); // parent (UpperParent) wins
  });
});
