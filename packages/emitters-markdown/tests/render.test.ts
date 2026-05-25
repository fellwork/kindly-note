// End-to-end tests for @kindly-note/emitters-markdown — drives the real
// engine + @kindly-note/lang-markdown tokeniser through the markdown emitter
// and asserts on the produced semantic HTML.
//
// Proves spec §13 acceptance:
//   - Block structure: headings h1-h6, paragraphs, lists (ul/ol), blockquotes,
//     horizontal rules, fenced code (with + without sub-language highlighting).
//   - Inline: <strong>, <em>, <code>, <a href> with the URL security policy.
//   - SECURITY (spec §13.1): raw HTML escaped; javascript:/data: URLs
//     neutralised; on* never emitted; bidi controls normalised.

import { createHighlighter } from '@kindly-note/core';
import json from '@kindly-note/lang-json';
import markdown from '@kindly-note/lang-markdown';
import { describe, expect, it } from 'vitest';
import { markdownHtmlEmitter, markdownHtmlEmitterWith } from '../src/index.js';

function render(src: string, emitter = markdownHtmlEmitter): string {
  const hl = createHighlighter({ languages: [markdown, json], emitter });
  return hl.highlight(src, { language: 'markdown' }).value;
}

describe('block structure', () => {
  it('renders ATX headings at the right level', () => {
    expect(render('# Hello World')).toBe('<h1>Hello World</h1>');
    expect(render('### Sub')).toBe('<h3>Sub</h3>');
    expect(render('###### Deep')).toBe('<h6>Deep</h6>');
  });

  it('wraps ordinary prose in a paragraph', () => {
    expect(render('just some prose')).toBe('<p>just some prose</p>');
  });

  it('separates paragraphs on blank lines', () => {
    expect(render('para one\n\npara two')).toBe('<p>para one</p>\n<p>para two</p>');
  });

  it('renders an unordered list', () => {
    expect(render('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders an ordered list', () => {
    expect(render('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('renders a blockquote', () => {
    expect(render('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>');
  });

  it('renders a horizontal rule', () => {
    expect(render('---')).toBe('<hr>');
  });
});

describe('inline elements', () => {
  it('renders bold and italic', () => {
    expect(render('a **bold** and *italic* x')).toBe(
      '<p>a <strong>bold</strong> and <em>italic</em> x</p>',
    );
  });

  it('renders inline code, escaping its content', () => {
    expect(render('use `foo()` here')).toBe('<p>use <code>foo()</code> here</p>');
    expect(render('danger `<b>` x')).toBe('<p>danger <code>&lt;b&gt;</code> x</p>');
  });

  it('renders a safe link with an href', () => {
    expect(render('see [text](http://x.com) end')).toBe(
      '<p>see <a href="http://x.com">text</a> end</p>',
    );
  });

  it('renders bold inside a blockquote', () => {
    expect(render('> quoted **b**')).toBe(
      '<blockquote><p>quoted <strong>b</strong></p></blockquote>',
    );
  });
});

describe('fenced code', () => {
  it('highlights a JSON fence via the sub-language stream', () => {
    const html = render('```json\n{"a":1}\n```');
    expect(html.startsWith('<pre><code>')).toBe(true);
    expect(html.endsWith('</code></pre>')).toBe(true);
    // Sub-language scopes render as kn- spans.
    expect(html).toContain('<span class="kn-attr">&quot;a&quot;</span>');
    expect(html).toContain('<span class="kn-number">1</span>');
  });

  it('renders a generic (unknown-language) fence as escaped text', () => {
    const html = render('```\n<script>x</script>\n```');
    expect(html).toBe('<pre><code>&lt;script&gt;x&lt;/script&gt;</code></pre>');
  });
});

describe('SECURITY — spec §13.1', () => {
  it('escapes raw HTML in markdown source by default', () => {
    const html = render('before <script>alert(1)</script> after');
    expect(html).toBe('<p>before &lt;script&gt;alert(1)&lt;/script&gt; after</p>');
    expect(html).not.toContain('<script>');
  });

  it('escapes an <img onerror=...> injection (no live tag, no live attribute)', () => {
    const html = render('x <img src=q onerror="alert(1)"> y');
    // The whole tag is inert escaped text — the `<` is escaped so no element
    // is created and the `onerror` string can never fire as an attribute.
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/<[a-z]+[^>]*\son\w+=/i);
    expect(html).toContain('&lt;img');
  });

  it('neutralises a javascript: link — text preserved, no href', () => {
    const html = render('click [here](javascript:alert(1)) now');
    expect(html).toContain('<a>here</a>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('href');
  });

  it('neutralises a data: URL by default', () => {
    const html = render('[x](data:text/html,<script>1</script>)');
    expect(html).toContain('<a>x</a>');
    expect(html).not.toContain('data:');
  });

  it('never emits an on* attribute (structural guarantee)', () => {
    const html = render('[a](http://x.com "onmouseover=alert(1)")');
    expect(html).not.toMatch(/\son\w+=/i);
  });

  it('normalises Unicode bidi control characters to U+FFFD by default', () => {
    // U+202E is the right-to-left override used in trojan-source attacks.
    const html = render('safe‮evil');
    expect(html).not.toContain('‮');
    expect(html).toContain('�');
  });

  it('preserves bidi controls when explicitly opted in', () => {
    const factory = markdownHtmlEmitterWith({ preserveBidiControls: true });
    const html = render('safe‮evil', factory);
    expect(html).toContain('‮');
  });

  it('honours a custom urlAllowlist', () => {
    const httpsOnly = markdownHtmlEmitterWith({ urlAllowlist: ['https'] });
    expect(render('[a](http://x.com)', httpsOnly)).toContain('<a>a</a>');
    expect(render('[a](https://x.com)', httpsOnly)).toContain('<a href="https://x.com">a</a>');
  });

  it('defeats control-character scheme obfuscation', () => {
    const html = render('[a](java\tscript:alert(1))');
    expect(html).not.toContain('javascript');
    expect(html).toContain('<a>a</a>');
  });
});

describe('GFM is NOT implemented (out of scope, spec §13.2)', () => {
  it('does not render a table', () => {
    const html = render('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).not.toContain('<table');
  });

  it('does not render strikethrough', () => {
    const html = render('~~struck~~');
    expect(html).not.toContain('<del');
    expect(html).not.toContain('<s>');
  });

  it('does not render a task-list checkbox', () => {
    const html = render('- [ ] todo');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('<input');
  });
});
