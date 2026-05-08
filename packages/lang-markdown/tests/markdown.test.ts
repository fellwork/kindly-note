// End-to-end tests for @kindly-note/lang-markdown.
//
// Proves cohort-7a acceptance gates from dispatch §D:
//   1. (Pre-flight regression) — verified by full workspace test run.
//   2. ATX headers — `#` through `######` with `meta` on hashes, `section` on body.
//   3. Bold + italic — three-tier nesting per upstream's structure.
//   4. Inline code — backticks NOT included in the scoped span.
//   5. Fenced code with `subLanguage:` (THE PROOF POINT) — register `lang-json`,
//      assert `addSubLanguage(stream, 'json')` is called.
//   6. Lists — bullet markers scope as `bullet`.
//   7. Inline links — `link` on text, `string` on url.
//   8. Blockquote — `quote` scope on the body.
//   9. Horizontal rule — `meta` scope.
//  10. `extensible: MarkdownExtensionPoints` declared.
//  11. (Static rule — no node-builtins / DOM in src/) verified by build config.
//  12. `disableAutodetect: false` — markdown is in the auto-detect candidate set.
//
// Ref shape for assertions: `r._tokenStream` carries the canonical TokenStream;
// the helpers below walk it to extract (scope, text) pairs and sub-language
// events, identical to lang-json's test pattern (see lang-json/tests/json.test.ts).

import { createHighlighter } from '@kindly-note/core';
import type { TokenNode, TokenScope, TokenStream } from '@kindly-note/core';
import json from '@kindly-note/lang-json';
import { describe, expect, it } from 'vitest';
import markdown, { type MarkdownExtensionPoints } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers — TokenStream walkers for assertions.
// ---------------------------------------------------------------------------

interface ScopeEvent {
  scope?: string;
  text: string;
}

/** Collect every (scope, text) pair in a TokenStream, depth-first. */
function flattenScopes(stream: TokenStream | undefined): ScopeEvent[] {
  const out: ScopeEvent[] = [];
  if (stream === undefined) return out;
  function walk(node: TokenNode, ancestor: string | undefined): void {
    if (node.type === 'text') {
      out.push({ scope: ancestor, text: node.text });
    } else if (node.type === 'scope') {
      const scope = (node as TokenScope).scope ?? ancestor;
      for (const c of node.children) walk(c, scope);
    } else if (node.type === 'sub-language') {
      // Skip — sub-language events are walked separately via flattenSubLanguages.
    }
  }
  for (const c of stream.children) walk(c, stream.scope);
  return out;
}

interface SubLangEvent {
  language: string;
  stream: TokenStream;
}

/** Collect every sub-language insertion in a TokenStream, depth-first. */
function flattenSubLanguages(stream: TokenStream | undefined): SubLangEvent[] {
  const out: SubLangEvent[] = [];
  if (stream === undefined) return out;
  function walk(node: TokenNode): void {
    if (node.type === 'sub-language') {
      out.push({ language: node.language, stream: node.stream });
      return;
    }
    if (node.type === 'scope') {
      for (const c of node.children) walk(c);
    }
  }
  for (const c of stream.children) walk(c);
  return out;
}

/** Find every token whose scope === target, ordered by appearance. */
function tokensWithScope(stream: TokenStream | undefined, target: string): string[] {
  return flattenScopes(stream)
    .filter((t) => t.scope === target)
    .map((t) => t.text);
}

// ---------------------------------------------------------------------------
// Acceptance gate — language shape (10, 11, 12)
// ---------------------------------------------------------------------------

describe('@kindly-note/lang-markdown — language shape', () => {
  it('default export is a deep-frozen LanguageDefinition (spec §0 shift #2, §9.1)', () => {
    expect(Object.isFrozen(markdown)).toBe(true);
    expect(Object.isFrozen(markdown.contains)).toBe(true);
  });

  it('mutating the contains array throws', () => {
    expect(() => {
      (markdown.contains as unknown[]).push({ scope: 'fake' });
    }).toThrow();
  });

  it('name is "Markdown" and aliases include md/markdown/mkdown/mkd (spec §1.5)', () => {
    expect(markdown.name).toBe('Markdown');
    expect(markdown.aliases).toContain('md');
    expect(markdown.aliases).toContain('markdown');
    expect(markdown.aliases).toContain('mkdown');
    expect(markdown.aliases).toContain('mkd');
  });

  it('publishes the typed MarkdownExtensionPoints via `extensible` (spec §13.2)', () => {
    expect(markdown.extensible).toBeDefined();
    const ext = markdown.extensible as MarkdownExtensionPoints;
    expect(ext.INLINE_CONTAINS).toBeDefined();
    expect(ext.BLOCK_CONTAINS).toBeDefined();
    expect(ext.LINK_MODE).toBeDefined();
    // The contains arrays are frozen so descendants cannot mutate them.
    expect(Object.isFrozen(ext.INLINE_CONTAINS)).toBe(true);
    expect(Object.isFrozen(ext.BLOCK_CONTAINS)).toBe(true);
    expect(Object.isFrozen(ext.LINK_MODE)).toBe(true);
  });

  it('disableAutodetect is not true — markdown is auto-detect-eligible (spec §1.5 gate #12)', () => {
    // The default for disableAutodetect is undefined (treated as false). Tests
    // confirm we did NOT explicitly opt out of auto-detect candidacy.
    expect(markdown.disableAutodetect).toBeFalsy();
  });

  it('aliases md/markdown resolve to the same handle', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const a = hl.getLanguage('markdown');
    const b = hl.getLanguage('md');
    const c = hl.getLanguage('mkdown');
    const d = hl.getLanguage('mkd');
    expect(a).toBeDefined();
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBe(d);
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #2 — ATX headers
// ---------------------------------------------------------------------------

describe('lang-markdown — ATX headers (spec §1.5 acceptance gate #2)', () => {
  it('highlights `# H1` with meta on `#` and section on body', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('# Hello', { language: 'markdown' });
    expect(r.illegal).toBe(false);

    const metas = tokensWithScope(r._tokenStream, 'meta');
    expect(metas).toContain('#');
    const sections = tokensWithScope(r._tokenStream, 'section');
    expect(sections.join('')).toContain('Hello');
  });

  it('highlights `### H3` with three `#`s scoped meta', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('### Hello', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const metas = tokensWithScope(r._tokenStream, 'meta');
    expect(metas).toContain('###');
  });

  it('covers all six header levels', () => {
    const hl = createHighlighter({ languages: [markdown] });
    for (let n = 1; n <= 6; n++) {
      const hashes = '#'.repeat(n);
      const src = `${hashes} Header${n}`;
      const r = hl.highlight(src, { language: 'markdown' });
      expect(r.illegal, `level ${n} should not be illegal`).toBe(false);
      const metas = tokensWithScope(r._tokenStream, 'meta');
      expect(metas, `level ${n} hashes should be in meta`).toContain(hashes);
      const sections = tokensWithScope(r._tokenStream, 'section');
      expect(sections.join(''), `level ${n} body should be in section`).toContain(`Header${n}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #3 — Bold + italic
// ---------------------------------------------------------------------------

describe('lang-markdown — bold + italic (spec §1.5 acceptance gate #3)', () => {
  it('highlights `**bold**` with strong scope', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('**bold**', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const strong = tokensWithScope(r._tokenStream, 'strong');
    expect(strong.join('')).toContain('bold');
  });

  it('highlights `__bold__` with strong scope', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('__bold__', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const strong = tokensWithScope(r._tokenStream, 'strong');
    expect(strong.join('')).toContain('bold');
  });

  it('highlights `*italic*` with emphasis scope', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('*italic*', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const emphasis = tokensWithScope(r._tokenStream, 'emphasis');
    expect(emphasis.join('')).toContain('italic');
  });

  it('highlights `_italic_` with emphasis scope', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('_italic_', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const emphasis = tokensWithScope(r._tokenStream, 'emphasis');
    expect(emphasis.join('')).toContain('italic');
  });

  it('handles `***bold-italic***` — bold containing italic via the WITHOUT_BOLD nesting', () => {
    // Per upstream: 3-level nesting is intentionally not supported (spec
    // §1.5 acceptance gate #3 references this). The matcher should NOT
    // crash and should produce SOME scoped output.
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('***test***', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    // We assert at least one of strong/emphasis appears.
    const events = flattenScopes(r._tokenStream);
    const scopes = new Set(events.map((e) => e.scope).filter(Boolean));
    expect(scopes.has('strong') || scopes.has('emphasis')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #4 — Inline code
// ---------------------------------------------------------------------------

describe('lang-markdown — inline code (spec §1.5 acceptance gate #4)', () => {
  it('highlights `` `code` `` with code scope on the inner text', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('`code`', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const codes = tokensWithScope(r._tokenStream, 'code');
    // Excludebegin/excludeEnd is set on INLINE_CODE → backticks NOT inside
    // the `code` scope. The inner text IS.
    expect(codes.join('')).toContain('code');
    // The backticks are emitted as plain text (no scope).
    const allText = flattenScopes(r._tokenStream)
      .map((e) => e.text)
      .join('');
    expect(allText).toBe('`code`');
  });

  it('emits the scoped text without backticks', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('`code`', { language: 'markdown' });
    const codeText = tokensWithScope(r._tokenStream, 'code').join('');
    // Backticks are NOT in the scoped span.
    expect(codeText).not.toContain('`');
    expect(codeText).toBe('code');
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #5 — Fenced code with subLanguage (THE PROOF POINT)
// ---------------------------------------------------------------------------

describe('lang-markdown — fenced code with subLanguage (spec §1.5 acceptance gate #5)', () => {
  it('dispatches a ```json fence to lang-json via addSubLanguage(stream, "json")', () => {
    // Register both languages — markdown is the parent, json is the
    // sub-language. The matcher's processSubLanguage path
    // (matcher.ts:191) calls runSubLanguage with the buffered text
    // between begin/end, then emitter.addSubLanguage(stream, 'json').
    const hl = createHighlighter({ languages: [markdown, json] });
    const code = '```json\n{"a":1}\n```';
    const r = hl.highlight(code, { language: 'markdown' });
    expect(r.illegal).toBe(false);

    // Assert that addSubLanguage('json', ...) was called by inspecting the
    // emitted TokenStream for a sub-language node.
    const subs = flattenSubLanguages(r._tokenStream);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs[0]?.language).toBe('JSON');

    // The sub-language's TokenStream contains JSON-tokenised content. We
    // check that at least one JSON-typical scope (`attr`, `number`, or
    // `punctuation`) appears in the sub-stream — that's the proof that
    // lang-json's modes ran on the fenced content.
    const subEvents = flattenScopes(subs[0]?.stream);
    const subScopes = new Set(subEvents.map((e) => e.scope).filter(Boolean));
    expect(
      subScopes.has('attr') || subScopes.has('number') || subScopes.has('punctuation'),
      'expected at least one JSON scope in the sub-language stream',
    ).toBe(true);
  });

  it('the fence body itself is wrapped in code scope at the outer level', () => {
    const hl = createHighlighter({ languages: [markdown, json] });
    const r = hl.highlight('```json\n{"a":1}\n```', { language: 'markdown' });
    // The outer scope around the sub-language should be `code`. Walk up
    // from the sub-language node and assert its ancestor scope is `code`.
    const tree = r._tokenStream;
    expect(tree).toBeDefined();
    let foundCodeWithSub = false;
    function walk(node: TokenNode, parentScope?: string): void {
      if (node.type === 'sub-language' && parentScope === 'code') {
        foundCodeWithSub = true;
        return;
      }
      if (node.type === 'scope') {
        const scope = node.scope ?? parentScope;
        for (const c of node.children) walk(c, scope);
      }
    }
    if (tree) for (const c of tree.children) walk(c, tree.scope);
    expect(foundCodeWithSub).toBe(true);
  });

  it('a fenced block without subLanguage support falls back to plain code scope', () => {
    // No `lang-json` registered → matcher.ts:199 falls through to
    // emitter.addText. The body is plain text under the `code` scope.
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('```unknown\nfoo\n```', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const codes = tokensWithScope(r._tokenStream, 'code');
    expect(codes.join('')).toContain('foo');
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #6 — Lists
// ---------------------------------------------------------------------------

describe('lang-markdown — lists (spec §1.5 acceptance gate #6)', () => {
  it('highlights `- ` and `- ` markers as bullet (unordered)', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('- a\n- b', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const bullets = tokensWithScope(r._tokenStream, 'bullet');
    // Two list markers expected.
    expect(bullets.length).toBeGreaterThanOrEqual(2);
  });

  it('highlights `1. ` and `2. ` as bullet (ordered)', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('1. a\n2. b', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const bullets = tokensWithScope(r._tokenStream, 'bullet');
    expect(bullets.length).toBeGreaterThanOrEqual(2);
  });

  it('handles `* ` and `+ ` markers', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('* a\n+ b', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const bullets = tokensWithScope(r._tokenStream, 'bullet');
    expect(bullets.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #7 — Inline links
// ---------------------------------------------------------------------------

describe('lang-markdown — inline links (spec §1.5 acceptance gate #7)', () => {
  it('highlights `[text](url)` with link on text and string on url', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('[click](https://example.com)', { language: 'markdown' });
    expect(r.illegal).toBe(false);

    const linkTexts = tokensWithScope(r._tokenStream, 'link');
    expect(linkTexts.join('')).toBe('click');

    const urlStrings = tokensWithScope(r._tokenStream, 'string');
    expect(urlStrings.join('')).toBe('https://example.com');
  });

  it('the syntax brackets `[`, `](`, `)` are scoped as meta', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('[a](b)', { language: 'markdown' });
    const metas = tokensWithScope(r._tokenStream, 'meta');
    // Three meta groups — `[`, `](`, `)` per the multi-capture scope map.
    expect(metas).toContain('[');
    expect(metas).toContain('](');
    expect(metas).toContain(')');
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #8 — Blockquote
// ---------------------------------------------------------------------------

describe('lang-markdown — blockquote (spec §1.5 acceptance gate #8)', () => {
  it('highlights `> text` with quote scope', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('> hello', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const quotes = tokensWithScope(r._tokenStream, 'quote');
    // Body of the quote — at minimum the text "hello" is inside the quote.
    expect(quotes.join('')).toContain('hello');
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #9 — Horizontal rule
// ---------------------------------------------------------------------------

describe('lang-markdown — horizontal rule (spec §1.5 acceptance gate #9)', () => {
  it('highlights `---` on its own line as meta', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('---', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const metas = tokensWithScope(r._tokenStream, 'meta');
    expect(metas).toContain('---');
  });

  it('highlights `***` on its own line as meta', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('***', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const metas = tokensWithScope(r._tokenStream, 'meta');
    expect(metas).toContain('***');
  });

  it('highlights `___` on its own line as meta', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('___', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    const metas = tokensWithScope(r._tokenStream, 'meta');
    expect(metas).toContain('___');
  });
});

// ---------------------------------------------------------------------------
// Backslash escape (in-scope per dispatch — pass through as plain text)
// ---------------------------------------------------------------------------

describe('lang-markdown — backslash escapes (CommonMark §6.1)', () => {
  it('treats `\\*` as literal text, not as italic opener', () => {
    const hl = createHighlighter({ languages: [markdown] });
    const r = hl.highlight('\\*not italic\\*', { language: 'markdown' });
    expect(r.illegal).toBe(false);
    // No emphasis scope should appear because the escapes prevent the italic
    // openers from firing.
    const emphasis = tokensWithScope(r._tokenStream, 'emphasis');
    expect(emphasis.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed-content sanity check
// ---------------------------------------------------------------------------

describe('lang-markdown — mixed-content highlight', () => {
  it('handles a small README-style document without illegal:true', () => {
    const hl = createHighlighter({ languages: [markdown, json] });
    const src = `# Title

A paragraph with **bold**, *italic*, and \`code\`.

## Subsection

- list item 1
- list item 2

> A blockquote with **bold** inside.

---

\`\`\`json
{"key": "value"}
\`\`\`

Visit [example](https://example.com) for more.
`;
    const r = hl.highlight(src, { language: 'markdown' });
    expect(r.illegal).toBe(false);

    // Collect all scopes seen — sanity check the major categories appear.
    const events = flattenScopes(r._tokenStream);
    const scopes = new Set(events.map((e) => e.scope).filter(Boolean));
    expect(scopes.has('section')).toBe(true);
    expect(scopes.has('strong')).toBe(true);
    expect(scopes.has('emphasis')).toBe(true);
    expect(scopes.has('code')).toBe(true);
    expect(scopes.has('bullet')).toBe(true);
    expect(scopes.has('quote')).toBe(true);
    expect(scopes.has('meta')).toBe(true);
    expect(scopes.has('link')).toBe(true);
    expect(scopes.has('string')).toBe(true);

    // Sub-language dispatch fired for the JSON fence.
    const subs = flattenSubLanguages(r._tokenStream);
    expect(subs.length).toBe(1);
    expect(subs[0]?.language).toBe('JSON');
  });
});
