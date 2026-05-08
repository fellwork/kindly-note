// Tests for @kindly-note/lang-pack-ecmascript number-mode.
//
// spec §1.2 row mandates `EXTENDED_NUMBER_MODE` (a frozen Mode constant) and
// `extendedNumberMode()` (a factory accepting a partial Mode override).
//
// Acceptance:
//   1. The constant is deep-frozen — `Object.isFrozen(EXTENDED_NUMBER_MODE)`
//      is true; mutating fields throws (spec §0 shift #2).
//   2. The factory returns a fresh frozen Mode each call (referential
//      transparency / no aliasing).
//   3. The number regex source matches the documented forms (hex, decimal,
//      exponent, NaN, ±Infinity).

import type { Mode } from '@kindly-note/core';
import { describe, expect, it } from 'vitest';
import { EXTENDED_NUMBER_MODE, EXTENDED_NUMBER_RE, extendedNumberMode } from '../src/index.js';

describe('EXTENDED_NUMBER_MODE — frozen Mode constant (spec §0 shift #2, §9.1)', () => {
  it('is deep-frozen (spec acceptance gate #2)', () => {
    expect(Object.isFrozen(EXTENDED_NUMBER_MODE)).toBe(true);
  });

  it('has scope: number, match: regex source, relevance: 0', () => {
    expect(EXTENDED_NUMBER_MODE.scope).toBe('number');
    expect(EXTENDED_NUMBER_MODE.match).toBe(EXTENDED_NUMBER_RE);
    expect(EXTENDED_NUMBER_MODE.relevance).toBe(0);
  });

  it('mutating a field throws (frozen)', () => {
    expect(() => {
      // Cast through `as` to escape the readonly contract — simulate a
      // misbehaving consumer.
      (EXTENDED_NUMBER_MODE as { scope?: string }).scope = 'mutated';
    }).toThrow();
  });

  it('is identity-stable across re-imports (referentially transparent)', async () => {
    // Re-import the module and confirm both views see the same instance.
    const mod = await import('../src/index.js');
    expect(mod.EXTENDED_NUMBER_MODE).toBe(EXTENDED_NUMBER_MODE);
  });
});

describe('EXTENDED_NUMBER_RE — regex source coverage', () => {
  // Compile once with anchors so we test "the whole string is a valid number"
  // rather than "the regex eventually matches somewhere".
  const re = new RegExp(`^(?:${EXTENDED_NUMBER_RE})$`);

  it('matches integer literals', () => {
    expect(re.test('0')).toBe(true);
    expect(re.test('42')).toBe(true);
    expect(re.test('123456')).toBe(true);
  });

  it('matches signed integers', () => {
    expect(re.test('-3')).toBe(true);
    expect(re.test('+7')).toBe(true);
  });

  it('matches floats and decimals', () => {
    expect(re.test('1.5')).toBe(true);
    expect(re.test('0.5')).toBe(true);
    expect(re.test('.5')).toBe(true);
    expect(re.test('-2.5')).toBe(true);
    // Trailing-decimal form (`12.`) is allowed by upstream (`\\d+(\\.\\d*)?`).
    expect(re.test('12.')).toBe(true);
  });

  it('matches exponent forms', () => {
    expect(re.test('1e6')).toBe(true);
    expect(re.test('1.2e-3')).toBe(true);
    expect(re.test('1E10')).toBe(true);
    expect(re.test('-1.5e+10')).toBe(true);
  });

  it('matches hex literals', () => {
    expect(re.test('0xFF')).toBe(true);
    expect(re.test('0xdeadbeef')).toBe(true);
    expect(re.test('0XFF')).toBe(true);
    expect(re.test('-0xFF')).toBe(true);
  });

  it('matches NaN and ±Infinity', () => {
    expect(re.test('NaN')).toBe(true);
    expect(re.test('Infinity')).toBe(true);
    expect(re.test('-Infinity')).toBe(true);
    expect(re.test('+Infinity')).toBe(true);
  });

  it('rejects non-number strings', () => {
    expect(re.test('hello')).toBe(false);
    expect(re.test('0xZZ')).toBe(false);
    expect(re.test('1.2.3')).toBe(false);
  });
});

describe('extendedNumberMode() — factory (spec §1.2)', () => {
  it('returns a frozen Mode', () => {
    const m = extendedNumberMode();
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('returns equal-but-distinct instances each call (no aliasing)', () => {
    const a = extendedNumberMode();
    const b = extendedNumberMode();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('preserves the canonical defaults when no overrides are supplied', () => {
    const m = extendedNumberMode();
    expect(m.scope).toBe('number');
    expect(m.match).toBe(EXTENDED_NUMBER_RE);
    expect(m.relevance).toBe(0);
  });

  it('honours scope override', () => {
    const m = extendedNumberMode({ scope: 'literal' });
    expect(m.scope).toBe('literal');
    expect(m.match).toBe(EXTENDED_NUMBER_RE);
  });

  it('honours relevance override', () => {
    const m = extendedNumberMode({ relevance: 5 });
    expect(m.relevance).toBe(5);
    expect(m.scope).toBe('number');
  });

  it('honours arbitrary Mode field overrides', () => {
    const m: Mode = extendedNumberMode({
      scope: 'literal',
      relevance: 2,
      label: 'extended-number',
    });
    expect(m.scope).toBe('literal');
    expect(m.relevance).toBe(2);
    expect(m.label).toBe('extended-number');
    expect(m.match).toBe(EXTENDED_NUMBER_RE);
  });

  it('does not mutate the EXTENDED_NUMBER_MODE constant', () => {
    const before = JSON.stringify(EXTENDED_NUMBER_MODE);
    extendedNumberMode({ scope: 'literal', relevance: 99 });
    const after = JSON.stringify(EXTENDED_NUMBER_MODE);
    expect(after).toBe(before);
  });
});
