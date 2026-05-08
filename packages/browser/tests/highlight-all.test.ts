// highlight-all.test.ts — batch DOM scan.
// Acceptance gate D-4: highlightAll selects + highlights multiple
// `<pre><code>` blocks, each with its own language.

import { beforeEach, describe, expect, it } from 'vitest';

import { createHighlighter } from '@kindly-note/core';
import { htmlEmitter } from '@kindly-note/emitters-html';
import javascriptLang from '@kindly-note/lang-javascript';
import jsonLang from '@kindly-note/lang-json';

import { KINDLY_NOTE_HIGHLIGHT_MARKER, highlightAll } from '@kindly-note/browser';

function clearBody(): void {
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
}

function makeBlock(language: string, code: string): HTMLElement {
  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.className = `language-${language}`;
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  document.body.appendChild(pre);
  return codeEl;
}

describe('highlightAll', () => {
  beforeEach(clearBody);

  it('highlights every matching <pre><code> block', () => {
    const hl = createHighlighter({
      languages: [jsonLang, javascriptLang],
      emitter: htmlEmitter,
    });

    const a = makeBlock('json', '{"a":1}');
    const b = makeBlock('javascript', 'const x = 1;');

    highlightAll(hl);

    expect(a.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    expect(b.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);

    // Each was highlighted with its own language.
    const aResult = (a as unknown as { result: { language: string } }).result;
    const bResult = (b as unknown as { result: { language: string } }).result;
    // Engine returns canonical names — JSON and JavaScript.
    expect(aResult.language).toBe('JSON');
    expect(bResult.language).toBe('JavaScript');
  });

  it('respects a custom selector', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });

    // Two blocks: one matches our custom selector; one does not.
    const matching = makeBlock('json', '{"a":1}');
    matching.classList.add('mine');
    const _other = makeBlock('json', '{"b":2}');

    highlightAll(hl, { selector: 'code.mine' });

    expect(matching.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    expect(_other.dataset.highlighted).toBeUndefined();
  });

  it('respects a custom root', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });

    const inside = makeBlock('json', '{"a":1}');
    const root = inside.parentElement;
    expect(root).not.toBeNull();

    // Add another block OUTSIDE the root.
    const outside = makeBlock('json', '{"b":2}');

    if (root === null) throw new Error('root should not be null');
    highlightAll(hl, { root });

    expect(inside.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    expect(outside.dataset.highlighted).toBeUndefined();
  });

  it('skips already-highlighted nodes (idempotence at batch level)', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const a = makeBlock('json', '{"a":1}');

    highlightAll(hl);
    const firstHTML = a.innerHTML;

    // Run again — still a no-op for the now-marked element.
    highlightAll(hl);
    expect(a.innerHTML).toBe(firstHTML);
  });

  it('uses hl.options.cssSelector as the default selector', () => {
    const hl = createHighlighter({
      languages: [jsonLang],
      emitter: htmlEmitter,
      // Default is 'pre code'; override to verify the option flows through.
      cssSelector: 'code.target',
    });

    const target = makeBlock('json', '{"a":1}');
    target.classList.add('target');
    const ignored = makeBlock('json', '{"b":2}');

    highlightAll(hl); // no explicit selector

    expect(target.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    expect(ignored.dataset.highlighted).toBeUndefined();
  });
});
