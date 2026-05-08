// End-to-end tests for @kindly-note/lang-json.
//
// Proves cohort-3b acceptance gates from dispatch §D:
//   2. Frozen LanguageDefinition export.
//   3. End-to-end highlight: every JSON token type gets the correct scope.
//   4. Aliases (`json`, `jsonc`, `json5`) resolve to the same handle.
//   5. Nested-object correctness — exercises the cohort-3a deepened matcher.
//   6. Whitespace and EOL preservation.
//   7. Compilation immutability — mutating the source after register has no
//      effect on highlight output.
//
// The proof point: lang-json is the first real `@kindly-note/lang-*` package,
// and these tests are the first end-to-end exercise of the deepened matcher
// landed by cohort 3a. If a test exposes a matcher gap, surface it as
// BLOCKED — see build-manifest-c3b.md.

import { createHighlighter } from '@kindly-note/core';
import type { TokenNode, TokenScope, TokenStream } from '@kindly-note/core';
import { htmlEmitter } from '@kindly-note/emitters-html';
import { describe, expect, it } from 'vitest';
import json from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers — TokenStream walkers for assertions.
// ---------------------------------------------------------------------------

/** Collect every (scope, text) pair in a TokenStream, depth-first. */
function flattenScopes(stream: TokenStream | undefined): Array<{ scope?: string; text: string }> {
  const out: Array<{ scope?: string; text: string }> = [];
  if (stream === undefined) return out;
  function walk(node: TokenNode, ancestor: string | undefined): void {
    if (node.type === 'text') {
      out.push({ scope: ancestor, text: node.text });
    } else if (node.type === 'scope') {
      // The CURRENT node's scope wins for its direct children.
      const scope = (node as TokenScope).scope ?? ancestor;
      for (const c of node.children) walk(c, scope);
    } else if (node.type === 'sub-language') {
      // Sub-languages don't appear in JSON; treat the inner stream as a
      // nested scope.
      for (const c of node.stream.children) walk(c, ancestor);
    }
  }
  for (const c of stream.children) walk(c, stream.scope);
  return out;
}

/** Find every token whose scope === target, ordered by appearance. */
function tokensWithScope(stream: TokenStream | undefined, target: string): string[] {
  return flattenScopes(stream)
    .filter((t) => t.scope === target)
    .map((t) => t.text);
}

/** All raw text in the stream — used for whitespace / EOL preservation tests. */
function flatText(stream: TokenStream | undefined): string {
  return flattenScopes(stream)
    .map((t) => t.text)
    .join('');
}

// ---------------------------------------------------------------------------
// Acceptance gate #2 — frozen LanguageDefinition export
// ---------------------------------------------------------------------------

describe('lang-json — frozen LanguageDefinition (spec §0 shift #2, §9.1)', () => {
  it('default export is a deep-frozen LanguageDefinition', () => {
    expect(Object.isFrozen(json)).toBe(true);
    expect(Object.isFrozen(json.contains)).toBe(true);
  });

  it('mutating the contains array throws', () => {
    expect(() => {
      // Bypass readonly via `as`.
      (json.contains as unknown[]).push({ scope: 'fake' });
    }).toThrow();
  });

  it('exposes the canonical name and the three aliases', () => {
    expect(json.name).toBe('JSON');
    expect(json.aliases).toEqual(['json', 'jsonc', 'json5']);
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #3 — end-to-end highlight (the proof point)
// ---------------------------------------------------------------------------

describe('lang-json — end-to-end highlight (cohort-3b proof point)', () => {
  it('highlights a flat JSON object with every token type', () => {
    const hl = createHighlighter({ languages: [json] });
    const code = '{"a": 1, "b": "hi", "c": true, "d": null, "e": [1, 2.5, -3]}';
    const r = hl.highlight(code, { language: 'json' });

    expect(r.illegal, 'illegal should be false on valid JSON').toBe(false);
    expect(r.language).toBe('JSON');

    const stream = r._tokenStream;
    const allText = flatText(stream);
    // Sample-based gate: every original character is preserved (no token
    // loss). The rendered text reads identically to the input.
    expect(allText).toBe(code);

    // Property keys → scope 'attr'. Spec §5.6 numbered call-trace.
    const attrs = tokensWithScope(stream, 'attr');
    expect(attrs).toEqual(['"a"', '"b"', '"c"', '"d"', '"e"']);

    // String values → scope 'string'. The `"hi"` value (NOT a key) goes
    // through quoteString from lang-helpers, which scopes the entire
    // delimiter-included lexeme. We assert the joined-string-output contains
    // the inner text — quoteString emits its scope as { startScope('string')
    // → addText('"') → addText('hi') → addText('"') → endScope() } so the
    // joined text under scope='string' is `"hi"`.
    const strings = flattenScopes(stream)
      .filter((t) => t.scope === 'string')
      .map((t) => t.text)
      .join('');
    expect(strings).toContain('hi');
    expect(strings).toContain('"');

    // Numbers → scope 'number'. EXTENDED_NUMBER_MODE handles ±integers,
    // decimals, exponents.
    const numbers = tokensWithScope(stream, 'number');
    expect(numbers).toContain('1');
    expect(numbers).toContain('2.5');
    expect(numbers).toContain('-3');

    // Boolean / null → scope 'literal'. LITERALS_MODE wraps each lexeme.
    const literals = tokensWithScope(stream, 'literal');
    expect(literals).toContain('true');
    expect(literals).toContain('null');
  });

  it('preserves structural punctuation as text nodes', () => {
    const hl = createHighlighter({ languages: [json] });
    const code = '{"a": [1, 2]}';
    const r = hl.highlight(code, { language: 'json' });
    const allText = flatText(r._tokenStream);
    // Every brace / bracket / comma / colon is preserved; no token is lost.
    expect(allText).toContain('{');
    expect(allText).toContain('}');
    expect(allText).toContain('[');
    expect(allText).toContain(']');
    expect(allText).toContain(',');
    expect(allText).toContain(':');
  });

  it('PUNCTUATION mode emits scope="punctuation" for braces/brackets', () => {
    const hl = createHighlighter({ languages: [json] });
    const r = hl.highlight('{"a": 1}', { language: 'json' });
    const punct = tokensWithScope(r._tokenStream, 'punctuation');
    // {, ", a, ", :, 1, }  → punctuation tokens are { : } (the colon and the
    // braces). The string and number have their own scopes, so they're not
    // here.
    expect(punct).toContain('{');
    expect(punct).toContain('}');
    expect(punct).toContain(':');
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #4 — aliases resolve
// ---------------------------------------------------------------------------

describe('lang-json — alias resolution (spec §1.2)', () => {
  it('resolves jsonc to the same RegisteredLanguage handle as json', () => {
    const hl = createHighlighter({ languages: [json] });
    const a = hl.getLanguage('json');
    const b = hl.getLanguage('jsonc');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b).toBe(a);
  });

  it('resolves json5 to the same RegisteredLanguage handle as json', () => {
    const hl = createHighlighter({ languages: [json] });
    const a = hl.getLanguage('json');
    const b = hl.getLanguage('json5');
    expect(b).toBe(a);
  });

  it('alias resolution is case-insensitive', () => {
    const hl = createHighlighter({ languages: [json] });
    expect(hl.getLanguage('JSONC')).toBeDefined();
    expect(hl.getLanguage('JSON5')).toBeDefined();
    expect(hl.getLanguage('Json')).toBeDefined();
  });

  it('listLanguages returns the canonical name "JSON"', () => {
    const hl = createHighlighter({ languages: [json] });
    expect(hl.listLanguages()).toEqual(['JSON']);
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #5 — nested-object correctness (matcher exercise)
// ---------------------------------------------------------------------------

describe('lang-json — nested objects and arrays (matcher cohort-3a exercise)', () => {
  it('handles a deeply nested object/array structure without losing tokens', () => {
    const hl = createHighlighter({ languages: [json] });
    const code = '{"a": {"b": [1, {"c": 2}]}}';
    const r = hl.highlight(code, { language: 'json' });
    expect(r.illegal, 'nested JSON must parse cleanly').toBe(false);

    const stream = r._tokenStream;
    const text = flatText(stream);
    // Every char preserved.
    expect(text).toBe(code);

    // All four property keys recognized with attr scope.
    const attrs = tokensWithScope(stream, 'attr');
    expect(attrs).toEqual(['"a"', '"b"', '"c"']);

    // Both numbers recognized.
    const numbers = tokensWithScope(stream, 'number');
    expect(numbers).toEqual(['1', '2']);
  });

  it('handles arrays of objects', () => {
    const hl = createHighlighter({ languages: [json] });
    const code = '[{"a": 1}, {"b": 2}, {"c": 3}]';
    const r = hl.highlight(code, { language: 'json' });
    expect(r.illegal).toBe(false);
    const attrs = tokensWithScope(r._tokenStream, 'attr');
    expect(attrs).toEqual(['"a"', '"b"', '"c"']);
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #6 — whitespace + EOL preservation
// ---------------------------------------------------------------------------

describe('lang-json — whitespace and EOL preservation', () => {
  it('preserves indentation, tabs, and newlines through the highlight pipeline', () => {
    const hl = createHighlighter({ languages: [json] });
    const code = '{\n\t"a": 1,\n\t"b": [\n\t\t1,\n\t\t2\n\t]\n}';
    const r = hl.highlight(code, { language: 'json' });
    expect(r.illegal).toBe(false);
    // The flat text concat reproduces the input byte-for-byte (no whitespace
    // collapsing, no \n→<br>, no tab→space).
    const text = flatText(r._tokenStream);
    expect(text).toBe(code);
    // Sanity: confirm the helpers actually saw newlines and tabs.
    expect(text).toContain('\n');
    expect(text).toContain('\t');
  });

  it('renders to HTML preserving whitespace as text nodes (htmlEmitter path)', () => {
    const hl = createHighlighter({ languages: [json], emitter: htmlEmitter });
    const code = '{\n  "a": 1\n}';
    const r = hl.highlight(code, { language: 'json' });
    // Whitespace appears unwrapped (no <span> around it). Sample-based check:
    // the rendered HTML must include `\n  ` literally.
    expect(r.value).toContain('\n  ');
    // The `kn-` default class prefix is present (spec §7.4 default lock).
    expect(r.value).toContain('class="kn-');
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #7 — compilation immutability
// ---------------------------------------------------------------------------

describe('lang-json — compilation immutability (spec §9.1)', () => {
  it('is registered against an already-frozen definition (cannot mutate post-register)', () => {
    const hl = createHighlighter({ languages: [json] });
    // Attempting to mutate the frozen contains array must throw.
    expect(() => {
      (json.contains as unknown[]).push({ scope: 'injected' });
    }).toThrow();
    // And the existing handle still highlights correctly.
    const r = hl.highlight('{"x": 1}', { language: 'json' });
    expect(r.illegal).toBe(false);
    expect(tokensWithScope(r._tokenStream, 'attr')).toEqual(['"x"']);
    expect(tokensWithScope(r._tokenStream, 'number')).toEqual(['1']);
  });
});

// ---------------------------------------------------------------------------
// Sanity / robustness checks
// ---------------------------------------------------------------------------

describe('lang-json — illegal handling', () => {
  it('flags non-JSON garbage as illegal', () => {
    const hl = createHighlighter({ languages: [json] });
    // `<<<` is not a JSON lexeme — illegal: '\\S' fires.
    const r = hl.highlight('<<<', { language: 'json' });
    expect(r.illegal).toBe(true);
  });

  it('accepts empty arrays and empty objects', () => {
    const hl = createHighlighter({ languages: [json] });
    expect(hl.highlight('{}', { language: 'json' }).illegal).toBe(false);
    expect(hl.highlight('[]', { language: 'json' }).illegal).toBe(false);
    expect(hl.highlight('[{}]', { language: 'json' }).illegal).toBe(false);
  });

  it('accepts negative numbers, floats, and exponents', () => {
    const hl = createHighlighter({ languages: [json] });
    const r = hl.highlight('[-1, 2.5, 1e6, 0xFF]', { language: 'json' });
    expect(r.illegal).toBe(false);
    const numbers = tokensWithScope(r._tokenStream, 'number');
    expect(numbers).toContain('-1');
    expect(numbers).toContain('2.5');
    expect(numbers).toContain('1e6');
    expect(numbers).toContain('0xFF');
  });
});
