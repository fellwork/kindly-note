// Tests for src/escape.ts — covers acceptance gate D-4 (HTML escaping).
import { describe, expect, it } from 'vitest';
import { htmlEscape } from '../src/escape.js';

describe('htmlEscape (escape.ts)', () => {
  it('passes ASCII through untouched', () => {
    expect(htmlEscape('hello world')).toBe('hello world');
    expect(htmlEscape('const x = 42;')).toBe('const x = 42;');
    expect(htmlEscape('')).toBe('');
  });

  it('escapes the five HTML special characters', () => {
    expect(htmlEscape('&')).toBe('&amp;');
    expect(htmlEscape('<')).toBe('&lt;');
    expect(htmlEscape('>')).toBe('&gt;');
    expect(htmlEscape('"')).toBe('&quot;');
    expect(htmlEscape("'")).toBe('&#x27;');
  });

  it('escapes ampersands first (no double-escaping)', () => {
    // Ordering matters: a naive replace chain that did `<` first would mangle
    // `&lt;` into `&amp;lt;`. Our regex-based replace picks the right entity
    // for each match in one pass.
    expect(htmlEscape('&amp;')).toBe('&amp;amp;');
    expect(htmlEscape('a < b && c > d')).toBe('a &lt; b &amp;&amp; c &gt; d');
  });

  it('escapes addText("<script>") to entity-safe form (acceptance gate D-4)', () => {
    expect(htmlEscape('<script>')).toBe('&lt;script&gt;');
    expect(htmlEscape('</script>')).toBe('&lt;/script&gt;');
  });

  it("escapes the dispatch §D-4 worked string with no raw '<' or '>' surviving", () => {
    const input = `<a href="x" onclick='alert(\`x\`)'>`;
    const out = htmlEscape(input);
    // No raw HTML metacharacters survive.
    expect(out.includes('<')).toBe(false);
    expect(out.includes('>')).toBe(false);
    // Apostrophes and quotes also escaped.
    expect(out.includes('"')).toBe(false);
    expect(out.includes("'")).toBe(false);
    // Backtick is not in the escape set (matches WHATWG + upstream).
    expect(out.includes('`')).toBe(true);
    // Spot-check the entity form.
    expect(out).toBe('&lt;a href=&quot;x&quot; onclick=&#x27;alert(`x`)&#x27;&gt;');
  });

  it('handles long strings without losing characters', () => {
    const big = '<x>'.repeat(1000);
    const out = htmlEscape(big);
    expect(out).toBe('&lt;x&gt;'.repeat(1000));
  });
});
