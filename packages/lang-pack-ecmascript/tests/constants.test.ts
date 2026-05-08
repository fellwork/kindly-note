// Tests for @kindly-note/lang-pack-ecmascript constants.
//
// spec §1.2: these constants are the data-only surface consumed by the
// ECMAScript family of `@kindly-note/lang-*` packages. Acceptance:
//   1. Every list is a frozen `readonly string[]`. spec §0 shift #2.
//   2. Every list contains the canonical ECMAScript names (KEYWORDS / LITERALS
//      / BUILT_INS / BUILT_IN_VARIABLES). Spot-checks are sufficient — the
//      lists are reference data, not behaviour.
//   3. `IDENT_RE` is a non-empty regex source string.
//   4. Importing the module has no observable side effects.

import { describe, expect, it } from 'vitest';
import { BUILT_INS, BUILT_IN_VARIABLES, IDENT_RE, KEYWORDS, LITERALS } from '../src/index.js';

describe('lang-pack-ecmascript constants — frozen / immutable (spec §0 shift #2)', () => {
  it('KEYWORDS is frozen', () => {
    expect(Object.isFrozen(KEYWORDS)).toBe(true);
  });

  it('LITERALS is frozen', () => {
    expect(Object.isFrozen(LITERALS)).toBe(true);
  });

  it('BUILT_INS is frozen', () => {
    expect(Object.isFrozen(BUILT_INS)).toBe(true);
  });

  it('BUILT_IN_VARIABLES is frozen', () => {
    expect(Object.isFrozen(BUILT_IN_VARIABLES)).toBe(true);
  });

  it('mutating KEYWORDS throws (frozen array)', () => {
    expect(() => {
      // Cast away readonly to simulate a misbehaving consumer.
      (KEYWORDS as string[]).push('intercepted');
    }).toThrow();
  });

  it('mutating BUILT_INS throws (frozen array)', () => {
    expect(() => {
      (BUILT_INS as string[]).push('intercepted');
    }).toThrow();
  });
});

describe('lang-pack-ecmascript constants — content (canonical ECMAScript surface)', () => {
  it('KEYWORDS contains the canonical reserved words', () => {
    // Spot-check across reserved words, contextual keywords, and module
    // syntax. The full list is in src/constants.ts; the goal here is to
    // catch accidental drops, not to enumerate.
    expect(KEYWORDS).toContain('if');
    expect(KEYWORDS).toContain('else');
    expect(KEYWORDS).toContain('while');
    expect(KEYWORDS).toContain('return');
    expect(KEYWORDS).toContain('class');
    expect(KEYWORDS).toContain('async');
    expect(KEYWORDS).toContain('await');
    expect(KEYWORDS).toContain('import');
    expect(KEYWORDS).toContain('export');
    expect(KEYWORDS).toContain('from');
    expect(KEYWORDS).toContain('using'); // stage-3 + included upstream
  });

  it('LITERALS includes the JSON triple plus the JS extras', () => {
    // JSON's literal lexemes (per the JSON spec):
    expect(LITERALS).toContain('true');
    expect(LITERALS).toContain('false');
    expect(LITERALS).toContain('null');
    // JS-only extras — kept in this list because lang-javascript consumes the
    // same frozen array; lang-json keeps its own narrower triple inline.
    expect(LITERALS).toContain('undefined');
    expect(LITERALS).toContain('NaN');
    expect(LITERALS).toContain('Infinity');
  });

  it('BUILT_INS covers core types, error types, and global functions', () => {
    // Constructor types
    expect(BUILT_INS).toContain('Object');
    expect(BUILT_INS).toContain('Array');
    expect(BUILT_INS).toContain('Map');
    expect(BUILT_INS).toContain('Promise');
    // Error types
    expect(BUILT_INS).toContain('Error');
    expect(BUILT_INS).toContain('TypeError');
    expect(BUILT_INS).toContain('RangeError');
    // Global functions
    expect(BUILT_INS).toContain('parseInt');
    expect(BUILT_INS).toContain('isNaN');
    expect(BUILT_INS).toContain('encodeURI');
    // JSON is a built-in object too (interesting for self-host detection).
    expect(BUILT_INS).toContain('JSON');
  });

  it('BUILT_IN_VARIABLES covers runtime-bound names', () => {
    expect(BUILT_IN_VARIABLES).toContain('this');
    expect(BUILT_IN_VARIABLES).toContain('super');
    expect(BUILT_IN_VARIABLES).toContain('arguments');
    expect(BUILT_IN_VARIABLES).toContain('console');
    expect(BUILT_IN_VARIABLES).toContain('window');
    expect(BUILT_IN_VARIABLES).toContain('document');
    expect(BUILT_IN_VARIABLES).toContain('module'); // CommonJS bridge
    expect(BUILT_IN_VARIABLES).toContain('global'); // Node.js
  });

  it('lists do not contain duplicates', () => {
    for (const [name, list] of [
      ['KEYWORDS', KEYWORDS],
      ['LITERALS', LITERALS],
      ['BUILT_INS', BUILT_INS],
      ['BUILT_IN_VARIABLES', BUILT_IN_VARIABLES],
    ] as const) {
      const set = new Set(list);
      expect(set.size, `${name} contains duplicates`).toBe(list.length);
    }
  });
});

describe('lang-pack-ecmascript constants — IDENT_RE', () => {
  it('IDENT_RE is a non-empty regex source string', () => {
    expect(typeof IDENT_RE).toBe('string');
    expect(IDENT_RE.length).toBeGreaterThan(0);
  });

  it('IDENT_RE compiles into a working RegExp', () => {
    // Build the regex with the same anchored-test pattern lang packs use.
    const re = new RegExp(`^(?:${IDENT_RE})$`);
    expect(re.test('foo')).toBe(true);
    expect(re.test('Foo123')).toBe(true);
    expect(re.test('123foo')).toBe(false); // no leading digit
    expect(re.test('hello-world')).toBe(false); // no hyphens
  });

  it('IDENT_RE re-exports the same string identity as @kindly-note/lang-helpers', async () => {
    // Spec compatibility / coupling note: lang-helpers is the canonical owner
    // of IDENT_RE; lang-pack-ecmascript re-exports the same constant. They
    // SHALL stay in lock-step.
    const helpers = await import('@kindly-note/lang-helpers');
    expect(IDENT_RE).toBe(helpers.IDENT_RE);
  });
});
