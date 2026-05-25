// End-to-end tests for @kindly-note/render-markdown — the one-call convenience
// wrapper. Proves the spec §1.5 usage example renders, code-fence languages
// highlight, and the §13.1 security defaults are inherited from
// @kindly-note/emitters-markdown.

import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
import json from '@kindly-note/lang-json';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/index.js';

describe('renderMarkdown (spec §1.5)', () => {
  it('renders the canonical CommonMark sample to semantic HTML', () => {
    const src = [
      '# Title',
      '',
      'A paragraph with **bold**, *italic*, `code`, and a [link](https://example.com).',
      '',
      '## Subhead',
      '',
      '- first',
      '- second',
      '',
      '1. one',
      '2. two',
      '',
      '> a quote',
      '',
      '---',
    ].join('\n');

    const html = renderMarkdown(src);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Subhead</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain('<ul><li>first</li><li>second</li></ul>');
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>');
    expect(html).toContain('<blockquote><p>a quote</p></blockquote>');
    expect(html).toContain('<hr>');
  });

  it('highlights a JS code fence when the language pack is provided', () => {
    const html = renderMarkdown('# Hi\n```js\nconst x = 1;\n```', { languages: [javascript] });
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).toContain('<pre><code>');
    // The JS keyword `const` is highlighted via the sub-language stream.
    expect(html).toContain('<span class="kn-keyword">const</span>');
  });

  it('renders an unknown-language fence as escaped plain text', () => {
    const html = renderMarkdown('```\n<b>x</b>\n```');
    expect(html).toBe('<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>');
  });

  it('adopts code-fence languages from a supplied highlighter', () => {
    const hl = createHighlighter({ languages: [json] });
    const html = renderMarkdown('```json\n{"a":1}\n```', { highlighter: hl });
    expect(html).toContain('<pre><code>');
    expect(html).toContain('<span class="kn-attr">&quot;a&quot;</span>');
  });

  it('honours a custom class prefix on highlighted fences', () => {
    const html = renderMarkdown('```js\nconst x = 1;\n```', {
      languages: [javascript],
      classPrefix: 'hljs-',
    });
    expect(html).toContain('<span class="hljs-keyword">const</span>');
  });
});

describe('renderMarkdown — security defaults inherited (spec §13.1)', () => {
  it('escapes raw HTML', () => {
    expect(renderMarkdown('x <script>alert(1)</script> y')).toBe(
      '<p>x &lt;script&gt;alert(1)&lt;/script&gt; y</p>',
    );
  });

  it('neutralises a javascript: link', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).toContain('<a>click</a>');
    expect(html).not.toContain('javascript:');
  });

  it('allows opting into a stricter URL allowlist', () => {
    const html = renderMarkdown('[a](http://x.com)', { urlAllowlist: ['https'] });
    expect(html).toContain('<a>a</a>');
  });
});

describe('renderMarkdown — GFM is out of scope (spec §13.2)', () => {
  it('does not render tables or strikethrough', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n~~struck~~');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('<del');
  });
});
