// Tests for regex source-string constants.
//
// spec §1.2: lang-helpers exports IDENT_RE, C_NUMBER_RE, BINARY_NUMBER_RE,
// RE_STARTERS_RE, NUMBER_RE (plus MATCH_NOTHING_RE, UNDERSCORE_IDENT_RE).
//
// These are source strings (not RegExp instances). The tests build a RegExp
// from each and assert behavior parity with the upstream intent.

import { describe, expect, it } from 'vitest';
import {
  BINARY_NUMBER_RE,
  C_NUMBER_RE,
  IDENT_RE,
  MATCH_NOTHING_RE,
  NUMBER_RE,
  RE_STARTERS_RE,
  UNDERSCORE_IDENT_RE,
} from '../src/index.js';

describe('regex constants — types and shapes', () => {
  it('IDENT_RE is a string source', () => {
    expect(typeof IDENT_RE).toBe('string');
    expect(IDENT_RE).toBe('[a-zA-Z]\\w*');
  });

  it('UNDERSCORE_IDENT_RE allows a leading underscore', () => {
    expect(typeof UNDERSCORE_IDENT_RE).toBe('string');
    expect(UNDERSCORE_IDENT_RE).toBe('[a-zA-Z_]\\w*');
  });

  it('NUMBER_RE matches plain decimals', () => {
    const re = new RegExp(NUMBER_RE);
    expect(re.test('123')).toBe(true);
    expect(re.test('12.34')).toBe(true);
  });

  it('C_NUMBER_RE matches hex, decimal, float, exponent', () => {
    const re = new RegExp(C_NUMBER_RE);
    expect(re.test('0xFF')).toBe(true);
    expect(re.test('123')).toBe(true);
    expect(re.test('1.23')).toBe(true);
    expect(re.test('.5')).toBe(true);
    expect(re.test('1e6')).toBe(true);
    expect(re.test('1.2e-3')).toBe(true);
  });

  it('BINARY_NUMBER_RE matches 0b... literals', () => {
    const re = new RegExp(BINARY_NUMBER_RE);
    expect(re.test('0b101')).toBe(true);
    expect(re.test('0b0')).toBe(true);
    expect(re.test('0xff')).toBe(false);
  });

  it('RE_STARTERS_RE matches operator-or-punct tokens that may precede a regex literal', () => {
    const re = new RegExp(`^(?:${RE_STARTERS_RE})$`);
    expect(re.test('=')).toBe(true);
    expect(re.test('==')).toBe(true);
    expect(re.test('===')).toBe(true);
    expect(re.test('!')).toBe(true);
    expect(re.test('&&')).toBe(true);
    expect(re.test('(')).toBe(true);
    expect(re.test('foo')).toBe(false);
  });
});

describe('MATCH_NOTHING_RE', () => {
  it('is a RegExp that never matches anything', () => {
    expect(MATCH_NOTHING_RE).toBeInstanceOf(RegExp);
    expect(MATCH_NOTHING_RE.test('')).toBe(false);
    expect(MATCH_NOTHING_RE.test('any')).toBe(false);
    expect(MATCH_NOTHING_RE.test('1234')).toBe(false);
  });
});

describe('IDENT_RE behavior', () => {
  it('matches plain identifiers but not leading-digit ones', () => {
    const re = new RegExp(`^${IDENT_RE}$`);
    expect(re.test('foo')).toBe(true);
    expect(re.test('Foo123')).toBe(true);
    expect(re.test('1foo')).toBe(false);
    expect(re.test('_foo')).toBe(false); // requires UNDERSCORE_IDENT_RE
  });

  it('UNDERSCORE_IDENT_RE matches identifiers with leading underscore', () => {
    const re = new RegExp(`^${UNDERSCORE_IDENT_RE}$`);
    expect(re.test('_foo')).toBe(true);
    expect(re.test('foo')).toBe(true);
    expect(re.test('1foo')).toBe(false);
  });
});
