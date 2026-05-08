// Worked end-to-end example: `highlightjs-line-numbers.js` (dispatch §D-6).
//
// spec §3.5 normative: a real upstream-ecosystem plugin uses `after:highlight`
// to rewrite `result.value` into a table of numbered lines. The fixture below
// is shaped like upstream's `highlightjs-line-numbers.js` (the published-name
// difference: `hljs-ln` → `hljs-line-numbers` in this fixture so the assertion
// matches the dispatch text).
//
// This test proves the entire pipeline:
//   1. createHighlighter registers a real language.
//   2. adaptLegacyPlugin wraps the legacy plugin.
//   3. The engine highlights some code.
//   4. The legacy `after:highlight` rewrites result.value.
//   5. The final value contains the line-numbers markup the legacy plugin
//      produced — proof the mutation crossed the adapter boundary correctly.

import { createHighlighter } from '@kindly-note/core';
import { htmlEmitter } from '@kindly-note/emitters-html';
import json from '@kindly-note/lang-json';
import { describe, expect, it } from 'vitest';
import { adaptLegacyPlugin } from '../src/index.js';
import lineNumbersLegacy from './fixtures/highlightjs-line-numbers.js';

describe('worked example: highlightjs-line-numbers.js (spec §3.5; dispatch §D-6)', () => {
  it('end-to-end: register highlighter + adapted line-numbers plugin → result.value contains hljs-line-numbers markup', () => {
    const hl = createHighlighter({
      languages: [json],
      emitter: htmlEmitter,
      plugins: [adaptLegacyPlugin(lineNumbersLegacy, 'highlightjs-line-numbers')],
    });

    const out = hl.highlight('{"a":1,\n"b":2}', { language: 'json' });

    // Spec §3.5 step 5: pipeline returns the table-wrapped result.
    expect(out.value).toContain('class="hljs-line-numbers"');
    expect(out.value).toContain('<table');
    expect(out.value).toContain('data-num="1"');
    expect(out.value).toContain('data-num="2"');
  });

  it("the legacy plugin sees the engine's HighlightResult value (spec §3.5 step 4 — `lineNumbersLegacy['after:highlight'](mutable)`)", () => {
    let observedValueAtHook: string | undefined;
    const observe = adaptLegacyPlugin(
      {
        'after:highlight': (result) => {
          observedValueAtHook = result.value;
        },
      },
      'observer',
    );
    const hl = createHighlighter({
      languages: [json],
      emitter: htmlEmitter,
      plugins: [observe, adaptLegacyPlugin(lineNumbersLegacy, 'highlightjs-line-numbers')],
    });
    hl.highlight('{"x":1}', { language: 'json' });

    // What the observer saw was the engine's raw highlighted HTML — not
    // wrapped in a table yet, since the line-numbers plugin runs AFTER the
    // observer (registration order; spec §2.3).
    expect(observedValueAtHook).toBeDefined();
    expect(observedValueAtHook).not.toContain('hljs-line-numbers');
    // Real highlighted output for json includes a kn- scope class.
    expect(observedValueAtHook).toMatch(/class="kn-/);
  });

  it('plugin-chain ordering: a `transformResult` plugin running AFTER the legacy line-numbers sees the wrapped value', () => {
    let observedAfterLineNumbers: string | undefined;
    const observeAfter = adaptLegacyPlugin(
      {
        'after:highlight': (result) => {
          observedAfterLineNumbers = result.value;
        },
      },
      'observer-after',
    );

    const hl = createHighlighter({
      languages: [json],
      emitter: htmlEmitter,
      // Order matters: line-numbers first, observer second.
      plugins: [adaptLegacyPlugin(lineNumbersLegacy, 'highlightjs-line-numbers'), observeAfter],
    });
    hl.highlight('{"x":1}', { language: 'json' });

    expect(observedAfterLineNumbers).toBeDefined();
    expect(observedAfterLineNumbers).toContain('hljs-line-numbers');
  });

  it('legacy plugin object is unchanged after adaptation (spec §3.4: pre-upgrade clones)', () => {
    const before = Object.keys(lineNumbersLegacy).sort();
    adaptLegacyPlugin(lineNumbersLegacy, 'highlightjs-line-numbers');
    expect(Object.keys(lineNumbersLegacy).sort()).toEqual(before);
  });
});
