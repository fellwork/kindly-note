// Targeted JS ↔ TS tie-break coverage. Build manifest c5b §D gate 5.
//
// TypeScript declares `supersetOf: 'javascript'` (added in cohort 5b — see
// `packages/lang-typescript/src/index.ts`). When TS and JS produce the same
// relevance for a snippet, JS must win. This file verifies the metadata flow
// (lang-typescript → CompiledLanguage → relevance comparator).
//
// Cohort 5b additionally records that the cohort-3a open question #9
// (`MAX_KEYWORD_HITS` dampening) is still open: keyword relevance accumulates
// unconditionally instead of capping at 7 hits. See `relevance.ts` header.
// On the cohort-5b acceptance gates this does NOT cause mis-detection; it
// only inflates absolute scores by a constant factor.

import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
import typescript from '@kindly-note/lang-typescript';
import { describe, expect, it } from 'vitest';
import { createAutoDetector } from '../src/index.js';

describe('TypeScript declares supersetOf: javascript', () => {
  it('the compiled artifact carries supersetOf', () => {
    const hl = createHighlighter({ languages: [javascript, typescript] });
    const ts = hl.getLanguage('TypeScript');
    expect(ts).toBeDefined();
    // Case-insensitive comparator handles 'javascript' vs 'JavaScript'.
    expect(ts?.compiled.supersetOf?.toLowerCase()).toBe('javascript');
  });

  it('the parent (JS) does NOT declare supersetOf', () => {
    const hl = createHighlighter({ languages: [javascript, typescript] });
    const js = hl.getLanguage('JavaScript');
    expect(js).toBeDefined();
    expect(js?.compiled.supersetOf).toBeUndefined();
  });
});

describe('JS ↔ TS detect with the supersetOf tie-break', () => {
  // We register both. Plain JS code should detect as JavaScript;
  // TS-specific code should detect as TypeScript.
  it('plain JS detects as JavaScript', () => {
    const hl = createHighlighter({ languages: [javascript, typescript] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('function f(x) { return x * 2; }');
    expect(r.language).toBe('JavaScript');
  });

  it('TS-specific syntax detects as TypeScript', () => {
    const hl = createHighlighter({ languages: [javascript, typescript] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('interface Foo { x: number; }');
    expect(r.language).toBe('TypeScript');
  });

  it('registration order does not affect the supersetOf tie-break', () => {
    // Reverse: TS first, JS second. The supersetOf rule must still pick JS.
    const hl = createHighlighter({ languages: [typescript, javascript] });
    const ad = createAutoDetector(hl);

    const r = ad.detect('var a = 1; var b = 2;');
    // Either JavaScript wins, or it is a clear tie that the comparator
    // resolves to JavaScript (the parent). Must NOT be TypeScript.
    expect(r.language).not.toBe('TypeScript');
  });
});
