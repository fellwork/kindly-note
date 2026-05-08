// highlight-element.test.ts — end-to-end DOM highlighting.
//
// Acceptance gates:
//   D-2: end-to-end highlight of a `<pre><code class="language-json">` block.
//   D-5: auto-detect path with caller-provided detector.
//   D-7: beforeElement / afterElement plugin hooks fire in order.
//   D-8: idempotence — second call is a no-op.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHighlighter, definePlugin } from '@kindly-note/core';
import { htmlEmitter } from '@kindly-note/emitters-html';
import jsonLang from '@kindly-note/lang-json';

import {
  type AutoDetectorLike,
  KINDLY_NOTE_HIGHLIGHT_MARKER,
  highlightElement,
} from '@kindly-note/browser';

function clearBody(): void {
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
}

function makeBlock(language: string, code: string): { pre: HTMLElement; code: HTMLElement } {
  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.className = `language-${language}`;
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  document.body.appendChild(pre);
  return { pre, code: codeEl };
}

describe('highlightElement — end-to-end', () => {
  beforeEach(clearBody);

  it('highlights a <pre><code class="language-json"> block end-to-end', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('json', '{"a":1}');

    highlightElement(code, hl);

    // Output contains kn-* classes (default classPrefix). We read the
    // rendered markup off the element to assert the post-condition.
    const rendered = code.innerHTML;
    expect(rendered).toContain('<span class="kn-attr">');
    // The string token "a" is in the output (escaped inside the span).
    expect(rendered).toContain('"a"');
    // Idempotence marker set.
    expect(code.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
  });

  it('attaches result.{language,relevance} to the element', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('json', '{"a":1}');

    highlightElement(code, hl);

    const result = (code as unknown as { result: { language: string; relevance: number } }).result;
    // The engine returns the language's canonical name ('JSON'); the
    // detector / class attribute used the alias 'json'.
    expect(result.language).toBe('JSON');
    expect(typeof result.relevance).toBe('number');
  });

  it('respects an explicit `language` option, ignoring the class attribute', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('typescript', '{"a":1}');

    highlightElement(code, hl, { language: 'json' });

    const rendered = code.innerHTML;
    expect(rendered).toContain('<span class="kn-attr">');
    const result = (code as unknown as { result: { language: string } }).result;
    expect(result.language).toBe('JSON');
  });

  it('falls through to engine safe-mode for unknown language (no detector)', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('made-up-lang', '{"a":1}');

    highlightElement(code, hl);

    // Marker still set (function ran to completion).
    expect(code.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
    // Output is the safe-mode passthrough — no kn-* spans, just escaped raw.
    const rendered = code.innerHTML;
    expect(rendered).not.toContain('<span class="kn-attr">');
  });
});

describe('highlightElement — auto-detect path', () => {
  beforeEach(clearBody);

  it('uses a caller-provided autoDetector when language is unknown', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('', '{"a":1}'); // no language class
    code.className = ''; // also remove class

    // Stub detector that always says "json".
    const detector: AutoDetectorLike = {
      detect: vi.fn().mockReturnValue({
        language: 'json',
        value: '<span>{"a":1}</span>',
        relevance: 5,
      }),
    };

    highlightElement(code, hl, { autoDetect: true, autoDetector: detector });

    // The detector was consulted.
    expect(detector.detect).toHaveBeenCalledWith('{"a":1}');
    // The engine re-ran with the detected language, producing kn-* spans.
    const rendered = code.innerHTML;
    expect(rendered).toContain('<span class="kn-attr">');
    expect(code.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);
  });

  it('attaches `secondBest` when the detector returned one', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('', '{"a":1}');
    code.className = '';

    const detector: AutoDetectorLike = {
      detect: () => ({
        language: 'json',
        secondBest: 'jsonc',
        value: '',
        relevance: 5,
      }),
    };

    highlightElement(code, hl, { autoDetect: true, autoDetector: detector });

    const second = (code as unknown as { secondBest?: { language: string } }).secondBest;
    expect(second).toBeDefined();
    expect(second?.language).toBe('jsonc');
  });

  it('does NOT call the detector when autoDetect is omitted', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('', '{"a":1}');
    code.className = '';

    const detector: AutoDetectorLike = { detect: vi.fn() };

    highlightElement(code, hl, { autoDetector: detector });

    expect(detector.detect).not.toHaveBeenCalled();
  });
});

describe('highlightElement — plugin hooks (spec §2.2)', () => {
  beforeEach(clearBody);

  it('fires beforeElement then afterElement, in that order', () => {
    const calls: string[] = [];
    const observer = definePlugin({
      name: 'test:observer',
      apiVersion: '1',
      beforeElement(input) {
        calls.push(`before:${input.language}`);
        return input;
      },
      afterElement(input) {
        calls.push(`after:${input.text}`);
      },
    });

    const hl = createHighlighter({
      languages: [jsonLang],
      plugins: [observer],
      emitter: htmlEmitter,
    });
    const { code } = makeBlock('json', '{"a":1}');

    highlightElement(code, hl);

    expect(calls).toEqual(['before:json', 'after:{"a":1}']);
  });

  it('lets a beforeElement plugin override the language', () => {
    const overrider = definePlugin({
      name: 'test:lang-override',
      apiVersion: '1',
      beforeElement(input) {
        return { ...input, language: 'json' };
      },
    });

    const hl = createHighlighter({
      languages: [jsonLang],
      plugins: [overrider],
      emitter: htmlEmitter,
    });
    const { code } = makeBlock('typescript', '{"a":1}'); // class says ts, plugin overrides
    highlightElement(code, hl);

    const result = (code as unknown as { result: { language: string } }).result;
    expect(result.language).toBe('JSON');
  });

  it('passes the post-highlight result + raw text to afterElement', () => {
    const seen: { value: string; text: string; language?: string }[] = [];
    const collector = definePlugin({
      name: 'test:collector',
      apiVersion: '1',
      afterElement(input) {
        seen.push({
          value: input.result.value,
          text: input.text,
          ...(input.result.language !== undefined ? { language: input.result.language } : {}),
        });
      },
    });

    const hl = createHighlighter({
      languages: [jsonLang],
      plugins: [collector],
      emitter: htmlEmitter,
    });
    const { code } = makeBlock('json', '{"a":1}');
    highlightElement(code, hl);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.text).toBe('{"a":1}');
    expect(seen[0]?.value).toContain('<span class="kn-attr">');
    expect(seen[0]?.language).toBe('JSON');
  });
});

describe('highlightElement — idempotence', () => {
  beforeEach(clearBody);

  it('is a no-op on a second call (preserves markup, does not re-run plugins)', () => {
    let calls = 0;
    const counter = definePlugin({
      name: 'test:counter',
      apiVersion: '1',
      afterElement() {
        calls++;
      },
    });

    const hl = createHighlighter({
      languages: [jsonLang],
      plugins: [counter],
      emitter: htmlEmitter,
    });
    const { code } = makeBlock('json', '{"a":1}');

    highlightElement(code, hl);
    const firstHTML = code.innerHTML;
    highlightElement(code, hl);

    expect(code.innerHTML).toBe(firstHTML);
    expect(calls).toBe(1);
  });

  it('re-highlights after the caller clears dataset.highlighted', () => {
    const hl = createHighlighter({ languages: [jsonLang], emitter: htmlEmitter });
    const { code } = makeBlock('json', '{"a":1}');

    highlightElement(code, hl);
    expect(code.dataset.highlighted).toBe(KINDLY_NOTE_HIGHLIGHT_MARKER);

    // Caller clears the marker AND restores text content.
    code.textContent = '{"b":2}';
    delete code.dataset.highlighted;

    highlightElement(code, hl);
    // New content reflected in the markup.
    expect(code.innerHTML).toContain('"b"');
  });
});
