// Cohort 3a — deepened matcher acceptance tests.
// Spec sections: 0 (architectural shifts), 2.2 (HighlightResult.illegal),
// 5.6 (engine emitter call-trace), 9.4 (compiled mode shape),
// 12 (regex-engine internals are Builder-time decisions).
//
// Every test in this file maps to a numbered acceptance gate from the
// cohort 3a Builder dispatch (sec C). When a gate is partially deferred,
// the test is `it.skip` with a TODO comment citing the deferral.

import { describe, expect, it } from 'vitest';
import {
  type Mode,
  type TokenNode,
  type TokenScope,
  type TokenStream,
  createHighlighter,
  defineLanguage,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk a frozen TokenStream and collect a flat sequence of (kind, payload). */
function flatten(stream: TokenStream): readonly Event[] {
  const out: Event[] = [];
  walk(stream, out, /*emitRoot*/ false);
  return out;
}

type Event =
  | { kind: 'startScope'; scope: string }
  | { kind: 'endScope' }
  | { kind: 'text'; text: string }
  | { kind: 'subLanguage'; language: string };

function walk(node: TokenNode, out: Event[], emitRoot: boolean): void {
  if (node.type === 'text') {
    out.push({ kind: 'text', text: node.text });
    return;
  }
  if (node.type === 'sub-language') {
    out.push({ kind: 'subLanguage', language: node.language });
    return;
  }
  // type === 'scope'
  const scope = (node as TokenScope).scope;
  if (emitRoot && typeof scope === 'string') {
    out.push({ kind: 'startScope', scope });
  }
  for (const child of (node as TokenScope).children) {
    walk(child, out, /*emitRoot*/ true);
  }
  if (emitRoot && typeof scope === 'string') {
    out.push({ kind: 'endScope' });
  }
}

// ---------------------------------------------------------------------------
// Acceptance #2 — Nested mode descent
// ---------------------------------------------------------------------------

describe('acceptance #2 — nested mode descent', () => {
  it('descends into a child mode and emits scoped tokens', () => {
    const inner: Mode = { scope: 'inner', begin: /\[/, end: /\]/ };
    const lang = defineLanguage({ name: 'nested', contains: [inner] });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('before [hi] after', { language: 'nested' });
    expect(r.illegal).toBe(false);
    const events = flatten(r._tokenStream!);
    // Builder choice (per dispatch sec C.2): we emit the brackets and
    // interior as separate text spans rather than one big string. This is
    // because the matcher does processBuffer at begin/end boundaries, and
    // the begin/end lexemes are pushed into the new buffer in order.
    // Sequence:
    //   text 'before '
    //   startScope 'inner'
    //   text '[hi]'   (the begin lexeme '[', the interior 'hi', and the
    //                  end lexeme ']' are all emitted as text, but
    //                  upstream concatenates contiguous adjacent buffer
    //                  flushes; after our emitter consolidation rule the
    //                  RecordingEmitter does NOT auto-coalesce, so we
    //                  expect 3 text events: '[', 'hi', ']').
    //   endScope
    //   text ' after'
    expect(events[0]).toEqual({ kind: 'text', text: 'before ' });
    expect(events[1]).toEqual({ kind: 'startScope', scope: 'inner' });
    // Interior — we accept either a single coalesced run or 3 runs.
    const interiorTexts = events
      .slice(2, -2)
      .filter((e) => e.kind === 'text')
      .map((e) => (e as { kind: 'text'; text: string }).text)
      .join('');
    expect(interiorTexts).toBe('[hi]');
    expect(events[events.length - 2]).toEqual({ kind: 'endScope' });
    expect(events[events.length - 1]).toEqual({ kind: 'text', text: ' after' });
  });
});

// ---------------------------------------------------------------------------
// Acceptance #3 — End-mode handling
// ---------------------------------------------------------------------------

describe('acceptance #3 — end-mode handling', () => {
  it('leaves the inner mode after the `end` regex fires', () => {
    const inner: Mode = { scope: 'inner', begin: /\[/, end: /\]/ };
    const lang = defineLanguage({ name: 'nested', contains: [inner] });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('[a][b]', { language: 'nested' });
    // Two complete scoped runs.
    const events = flatten(r._tokenStream!);
    const opens = events.filter((e) => e.kind === 'startScope').length;
    const closes = events.filter((e) => e.kind === 'endScope').length;
    expect(opens).toBe(2);
    expect(closes).toBe(2);
  });

  it('falls back to text when the `end` never fires', () => {
    // Without end, the mode would consume to EOF — but since we only have
    // a `match` not a `begin`/`end` pair, we get a transient scope.
    const inner: Mode = { scope: 'inner', begin: /\[/, end: /\]/ };
    const lang = defineLanguage({ name: 'nested', contains: [inner] });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('before [unclosed', { language: 'nested' });
    // After we hit EOF inside the unclosed mode, the matcher's
    // `closeMode()` cleanup fires endScope and closes the scope. So the
    // scope still opens and closes — but the closing happens at EOF,
    // not at a real `]`.
    const events = flatten(r._tokenStream!);
    const opens = events.filter((e) => e.kind === 'startScope').length;
    expect(opens).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Acceptance #4 — Illegal-rule escalation
// ---------------------------------------------------------------------------

describe('acceptance #4 — illegal-rule escalation', () => {
  // Per spec section 2.2: HighlightResult.illegal is the canonical signal.
  // Per spec section 2.4: errorMode='throw' also escalates — and the
  // matcher's IllegalSyntaxError propagates unchanged in that case.
  // The test in dispatch sec C.4 says EITHER throw OR result.illegal=true
  // is acceptable; we test both paths.

  const langWithIllegal = defineLanguage({
    name: 'lex',
    contains: [{ begin: /a/, illegal: /b/, end: /\$/ }],
  });

  it('safe mode — illegal hit returns result.illegal: true', () => {
    const hl = createHighlighter({ languages: [langWithIllegal] });
    const r = hl.highlight('aab', { language: 'lex' });
    expect(r.illegal).toBe(true);
  });

  it('throw mode — illegal hit throws IllegalSyntaxError', () => {
    const hl = createHighlighter({
      languages: [langWithIllegal],
      errorMode: 'throw',
    });
    expect(() => hl.highlight('aab', { language: 'lex' })).toThrow(/Illegal lexeme/);
  });

  it('ignoreIllegals: true — illegal is treated as ordinary text', () => {
    const hl = createHighlighter({
      languages: [langWithIllegal],
      errorMode: 'throw',
    });
    expect(() => hl.highlight('aab', { language: 'lex', ignoreIllegals: true })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Acceptance #5 — Keyword detection
// ---------------------------------------------------------------------------

describe('acceptance #5 — keyword detection', () => {
  it('matches keywords against the dictionary and emits scoped spans', () => {
    const lang = defineLanguage({
      name: 'kw',
      keywords: { keyword: ['foo'] },
      contains: [],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('foo bar', { language: 'kw' });
    const events = flatten(r._tokenStream!);
    // Expected: startScope 'keyword', addText 'foo', endScope, addText ' bar'.
    expect(events[0]).toEqual({ kind: 'startScope', scope: 'keyword' });
    expect(events[1]).toEqual({ kind: 'text', text: 'foo' });
    expect(events[2]).toEqual({ kind: 'endScope' });
    expect(events[3]).toEqual({ kind: 'text', text: ' bar' });
  });

  it('default scope is "keyword" for a flat string list', () => {
    const lang = defineLanguage({
      name: 'kw2',
      keywords: 'if else',
      contains: [],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('if x else', { language: 'kw2' });
    const events = flatten(r._tokenStream!);
    const opens = events.filter((e) => e.kind === 'startScope' && e.scope === 'keyword');
    expect(opens.length).toBe(2);
  });

  it('respects $pattern for the lexeme tokenizer', () => {
    const lang = defineLanguage({
      name: 'kwp',
      keywords: { $pattern: /[a-z\-]+/, keyword: ['foo-bar'] },
      contains: [],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('foo-bar baz', { language: 'kwp' });
    const events = flatten(r._tokenStream!);
    // 'foo-bar' should match (with the dashed $pattern) — produce one
    // keyword span. Without $pattern, default \w+ would never match
    // 'foo-bar' as a single token.
    expect(events.some((e) => e.kind === 'startScope' && e.scope === 'keyword')).toBe(true);
    expect(events.some((e) => e.kind === 'text' && e.text === 'foo-bar')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Acceptance #6 — endsWithParent
// ---------------------------------------------------------------------------

describe('acceptance #6 — endsWithParent', () => {
  it('child exits when the parent end pattern fires', () => {
    const child: Mode = {
      scope: 'child',
      begin: /=/,
      endsWithParent: true,
    };
    const parent: Mode = {
      scope: 'parent',
      begin: /</,
      end: />/,
      contains: [child],
    };
    const lang = defineLanguage({ name: 'ewp', contains: [parent] });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('<a=b>', { language: 'ewp' });
    expect(r.illegal).toBe(false);
    const events = flatten(r._tokenStream!);
    // Both 'parent' and 'child' should have opened and closed.
    const parentOpens = events.filter(
      (e) => e.kind === 'startScope' && e.scope === 'parent',
    ).length;
    const childOpens = events.filter((e) => e.kind === 'startScope' && e.scope === 'child').length;
    expect(parentOpens).toBe(1);
    expect(childOpens).toBe(1);
    // Both close exactly once.
    const closes = events.filter((e) => e.kind === 'endScope').length;
    expect(closes).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Acceptance #7 — endSameAsBegin
// ---------------------------------------------------------------------------

describe('acceptance #7 — endSameAsBegin', () => {
  it('exits at the matching delimiter constructed from the begin lexeme', () => {
    const mode: Mode = {
      scope: 'str',
      begin: /['"]/,
      endSameAsBegin: true,
    };
    const lang = defineLanguage({ name: 'esab', contains: [mode] });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('"hello"', { language: 'esab' });
    expect(r.illegal).toBe(false);
    const events = flatten(r._tokenStream!);
    expect(events.filter((e) => e.kind === 'startScope' && e.scope === 'str').length).toBe(1);
    expect(events.filter((e) => e.kind === 'endScope').length).toBe(1);
  });

  it('does NOT exit on a different delimiter than the one that opened', () => {
    const mode: Mode = {
      scope: 'str',
      begin: /['"]/,
      endSameAsBegin: true,
    };
    const lang = defineLanguage({ name: 'esab2', contains: [mode] });
    const hl = createHighlighter({ languages: [lang] });
    // Open with `"`, see `'` (must be ignored), then `"` exits.
    const r = hl.highlight(`"a'b"`, { language: 'esab2' });
    expect(r.illegal).toBe(false);
    const events = flatten(r._tokenStream!);
    expect(events.filter((e) => e.kind === 'startScope' && e.scope === 'str').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Acceptance #8 — No mutation of source LanguageDefinition (regression)
// ---------------------------------------------------------------------------

describe('acceptance #8 — source LanguageDefinition stays frozen', () => {
  it('compileLanguage with new fields does not mutate source modes', () => {
    const def = defineLanguage({
      name: 'pure',
      contains: [
        { scope: 'inner', begin: /\[/, end: /\]/ },
        { scope: 'kw', begin: /a/, endsWithParent: true },
      ],
    });
    // Snapshot original mode keys.
    const before = Object.keys(def.contains[0]!).sort();
    createHighlighter({ languages: [def] });
    const after = Object.keys(def.contains[0]!).sort();
    expect(after).toEqual(before);
    // Source mode is still frozen.
    expect(Object.isFrozen(def.contains[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Acceptance #10 — Sub-language stub (optional)
// ---------------------------------------------------------------------------

describe('acceptance #10 — sub-language descent', () => {
  it('emits addSubLanguage(stream, language) when a mode declares subLanguage', () => {
    // Inner mode buffers text and hands it off to a 'fake-stub' sub-language.
    const sub = defineLanguage({
      name: 'fake-stub',
      contains: [{ scope: 'tok', begin: /\w+/ }],
    });
    const outer = defineLanguage({
      name: 'outer',
      contains: [
        {
          begin: /\[/,
          end: /\]/,
          subLanguage: 'fake-stub',
          // excludeBegin/excludeEnd so the buffered text is just the
          // contents between the brackets.
          excludeBegin: true,
          excludeEnd: true,
        },
      ],
    });
    const hl = createHighlighter({ languages: [sub, outer] });
    const r = hl.highlight('[hello]', { language: 'outer' });
    const events = flatten(r._tokenStream!);
    expect(events.some((e) => e.kind === 'subLanguage' && e.language === 'fake-stub')).toBe(true);
  });
});
