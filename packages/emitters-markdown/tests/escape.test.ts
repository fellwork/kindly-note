// Unit tests for HTML escaping + bidi-control normalisation. spec §13.1.

import { describe, expect, it } from 'vitest';
import { htmlEscape, normalizeBidi } from '../src/index.js';

describe('htmlEscape', () => {
  it('escapes the five HTML special characters', () => {
    expect(htmlEscape('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#x27;');
  });

  it('escapes a script tag so it cannot execute', () => {
    expect(htmlEscape('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('passes plain text through unchanged', () => {
    expect(htmlEscape('hello world 123')).toBe('hello world 123');
  });
});

describe('normalizeBidi', () => {
  it('replaces a right-to-left override (U+202E) with U+FFFD', () => {
    const trojan = `safe${String.fromCodePoint(0x202e)}evil`;
    const out = normalizeBidi(trojan);
    expect(out).not.toContain(String.fromCodePoint(0x202e));
    expect(out).toContain('�');
  });

  it('replaces every targeted bidi/invisible control code point', () => {
    const cps = [
      0x061c, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
      0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
    ];
    for (const cp of cps) {
      const out = normalizeBidi(`a${String.fromCodePoint(cp)}b`);
      expect(out).toBe('a�b');
    }
  });

  it('leaves ordinary text untouched', () => {
    expect(normalizeBidi('plain text')).toBe('plain text');
  });
});
