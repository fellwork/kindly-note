// language-from-class.test.ts — class-name parser unit tests.
// dispatch §D-3: class-name parser handles `language-foo`, `lang-foo`,
// `kn-language-foo`.

import { describe, expect, it } from 'vitest';

import { languageFromClass } from '@kindly-note/browser';

function elWithClass(classes: string): Element {
  const el = document.createElement('code');
  el.className = classes;
  return el;
}

describe('languageFromClass', () => {
  it('matches `language-foo`', () => {
    expect(languageFromClass(elWithClass('language-json'))).toBe('json');
  });

  it('matches `lang-foo`', () => {
    expect(languageFromClass(elWithClass('lang-json'))).toBe('json');
  });

  it('matches `kn-language-foo`', () => {
    expect(languageFromClass(elWithClass('kn-language-json'))).toBe('json');
  });

  it('preserves hyphens in language names', () => {
    expect(languageFromClass(elWithClass('language-objective-c'))).toBe('objective-c');
    expect(languageFromClass(elWithClass('lang-react-native'))).toBe('react-native');
  });

  it('returns the kn-prefixed match when both kn- and non-prefixed are present', () => {
    // `kn-language-` wins over `language-`.
    expect(languageFromClass(elWithClass('language-typescript kn-language-json'))).toBe('json');
  });

  it('returns the language-prefixed match before the lang-prefixed one', () => {
    // `language-` wins over `lang-`.
    expect(languageFromClass(elWithClass('lang-typescript language-json'))).toBe('json');
  });

  it('finds the language class amid unrelated classes', () => {
    expect(languageFromClass(elWithClass('foo bar language-json baz'))).toBe('json');
  });

  it('returns undefined when no language class is present', () => {
    expect(languageFromClass(elWithClass('foo bar'))).toBeUndefined();
    expect(languageFromClass(elWithClass(''))).toBeUndefined();
  });

  it('returns undefined for malformed `language-` (no token)', () => {
    expect(languageFromClass(elWithClass('language-'))).toBeUndefined();
  });

  it('does not match when `language-` is a substring of another class', () => {
    // We require word boundary at the start (^|whitespace).
    expect(languageFromClass(elWithClass('mylanguage-json'))).toBeUndefined();
  });
});
