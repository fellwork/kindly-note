// Tests for the regex helpers. spec §7.3 capability table; §8.1 stable subpath.
import { describe, expect, it } from 'vitest';
import { regex } from '../src/index.js';

describe('regex helpers', () => {
  it('source coerces RegExp and string', () => {
    expect(regex.source(/abc/)).toBe('abc');
    expect(regex.source('def')).toBe('def');
    expect(regex.source(undefined)).toBe('');
    expect(regex.source(null)).toBe('');
  });

  it('concat joins fragments', () => {
    expect(regex.concat('a', /b/, 'c')).toBe('abc');
  });

  it('lookahead wraps in (?=...)', () => {
    expect(regex.lookahead('foo')).toBe('(?=foo)');
    expect(regex.lookahead(/bar/)).toBe('(?=bar)');
  });

  it('anyNumberOfTimes wraps in (?:...)*', () => {
    expect(regex.anyNumberOfTimes('a')).toBe('(?:a)*');
  });

  it('optional wraps in (?:...)?', () => {
    expect(regex.optional('a')).toBe('(?:a)?');
  });

  it('either builds non-capturing alternation by default', () => {
    expect(regex.either('a', 'b', 'c')).toBe('(?:a|b|c)');
  });

  it('either with { capture: true } builds a capture group', () => {
    expect(regex.either('a', 'b', { capture: true })).toBe('(a|b)');
  });

  it('either accepts mixed RegExp + string fragments', () => {
    expect(regex.either(/a/, 'b', /c/)).toBe('(?:a|b|c)');
  });

  it('escape escapes regex metachars', () => {
    expect(regex.escape('a.b*c')).toBe('a\\.b\\*c');
    expect(regex.escape('()[]{}')).toBe('\\(\\)\\[\\]\\{\\}');
  });

  it('countMatchGroups returns 0 for no groups', () => {
    expect(regex.countMatchGroups(/abc/)).toBe(0);
  });

  it('countMatchGroups counts capturing groups', () => {
    expect(regex.countMatchGroups(/(a)(b)(c)/)).toBe(3);
  });

  it('startsWith returns true on zero-index match', () => {
    expect(regex.startsWith(/abc/, 'abcdef')).toBe(true);
  });

  it('startsWith returns false on later match', () => {
    expect(regex.startsWith(/def/, 'abcdef')).toBe(false);
  });
});
