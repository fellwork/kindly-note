// Tests for src/scope-to-class.ts — covers acceptance gate D-3 (tiered scope mapping).
import { describe, expect, it } from 'vitest';
import { toClassNames } from '../src/scope-to-class.js';

describe('toClassNames (scope-to-class.ts) — spec §7.4 / Scout §5', () => {
  it('maps a simple scope with the prefix prepended', () => {
    expect(toClassNames('keyword', 'kn-')).toBe('kn-keyword');
    expect(toClassNames('keyword', 'hljs-')).toBe('hljs-keyword');
    expect(toClassNames('keyword', '')).toBe('keyword');
  });

  it('maps a tiered scope with verbatim trailing-underscore convention (acceptance gate D-3)', () => {
    // spec §7.4: title.class.inherited → kn-title class_ inherited__
    expect(toClassNames('title.class.inherited', 'kn-')).toBe('kn-title class_ inherited__');
  });

  it('produces the same tiered form under hljs- prefix', () => {
    // Same algorithm, different prefix on the head segment only.
    expect(toClassNames('title.class.inherited', 'hljs-')).toBe('hljs-title class_ inherited__');
  });

  it('handles two-tier scopes (one trailing underscore on tier 2)', () => {
    expect(toClassNames('comment.line', 'kn-')).toBe('kn-comment line_');
    expect(toClassNames('string.quoted', 'kn-')).toBe('kn-string quoted_');
  });

  it('handles four-tier scopes (each tier adds one more underscore)', () => {
    // Defensive: the algorithm is "i+1 underscores on the i-th tail piece"
    // for 0-indexed i. Four tiers → underscores _ __ ___ on tail pieces.
    expect(toClassNames('a.b.c.d', 'kn-')).toBe('kn-a b_ c__ d___');
  });

  it('strips the language: prefix and ignores the user prefix', () => {
    // spec §7.4 / Scout §5: language:foo → language-foo, prefix-free.
    expect(toClassNames('language:json', 'kn-')).toBe('language-json');
    expect(toClassNames('language:json', 'hljs-')).toBe('language-json');
    expect(toClassNames('language:typescript', '')).toBe('language-typescript');
  });

  it("does not treat 'language:' inside a tiered scope specially", () => {
    // The branch is `startsWith('language:')`, not `includes('language:')`.
    // A nested `prefix:value` pattern with a dot is still tiered.
    expect(toClassNames('attr.language:foo', 'kn-')).toBe('kn-attr language:foo_');
  });
});
