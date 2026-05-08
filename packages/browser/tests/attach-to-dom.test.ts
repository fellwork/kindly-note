// attach-to-dom.test.ts — initial scan + MutationObserver.
// Acceptance gate D-6: attach, then DOM mutation, then assert highlighted;
// dispose, then DOM mutation, then assert NOT highlighted.

import { beforeEach, describe, expect, it } from 'vitest';

import { createHighlighter } from '@kindly-note/core';
import { htmlEmitter } from '@kindly-note/emitters-html';
import jsonLang from '@kindly-note/lang-json';

import { KINDLY_NOTE_HIGHLIGHT_MARKER, attachToDOM } from '@kindly-note/browser';

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
  return pre;
}

/** Wait one microtask + one task — happy-dom delivers MutationObserver
 * callbacks asynchronously. */
async function flushMutations(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('attachToDOM', () => {
  beforeEach(clearBody);

  it('runs an initial scan on attach', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const block = makeBlock('json', '{"a":1}');
    document.body.appendChild(block);
    const codeEl = block.querySelector('code');
    expect(codeEl).not.toBeNull();

    const handle = attachToDOM(hl);
    try {
      expect(codeEl?.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    } finally {
      handle.dispose();
    }
  });

  it('highlights nodes added after attach (MutationObserver)', async () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const handle = attachToDOM(hl);

    try {
      const block = makeBlock('json', '{"a":1}');
      document.body.appendChild(block);

      await flushMutations();

      const codeEl = block.querySelector('code') as HTMLElement | null;
      expect(codeEl).not.toBeNull();
      expect(codeEl?.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    } finally {
      handle.dispose();
    }
  });

  it('does NOT highlight nodes added after dispose()', async () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const handle = attachToDOM(hl);
    handle.dispose();

    const block = makeBlock('json', '{"b":2}');
    document.body.appendChild(block);

    await flushMutations();

    const codeEl = block.querySelector('code') as HTMLElement | null;
    expect(codeEl).not.toBeNull();
    expect(codeEl?.dataset.highlighted).toBeUndefined();
  });

  it('handles deeply-nested matching descendants in added subtrees', async () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const handle = attachToDOM(hl);

    try {
      // Build a wrapper with a nested <pre><code> inside a section.
      const wrapper = document.createElement('section');
      const inner = makeBlock('json', '{"deep":true}');
      wrapper.appendChild(inner);
      document.body.appendChild(wrapper);

      await flushMutations();

      const codeEl = inner.querySelector('code') as HTMLElement | null;
      expect(codeEl).not.toBeNull();
      expect(codeEl?.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    } finally {
      handle.dispose();
    }
  });

  it('observeMutations: false performs only the initial scan', async () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const initial = makeBlock('json', '{"a":1}');
    document.body.appendChild(initial);

    const handle = attachToDOM(hl, { observeMutations: false });
    try {
      const initialCode = initial.querySelector('code') as HTMLElement | null;
      expect(initialCode?.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);

      // Add a NEW block; with no observer, it should NOT get highlighted.
      const later = makeBlock('json', '{"b":2}');
      document.body.appendChild(later);

      await flushMutations();

      const laterCode = later.querySelector('code') as HTMLElement | null;
      expect(laterCode?.dataset.highlighted).toBeUndefined();
    } finally {
      handle.dispose();
    }
  });

  it('returns an inert handle when no DOM is available', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    // Pass a root that is undefined-equivalent: an empty doc fragment with
    // no children. attachToDOM should still return a handle (no throw).
    const fragment = document.createDocumentFragment();
    const handle = attachToDOM(hl, { root: fragment });
    expect(typeof handle.dispose).toBe('function');
    handle.dispose();
  });
});
