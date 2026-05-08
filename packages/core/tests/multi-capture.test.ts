// Tests for multi-capture begin/match modes + variants expansion. Cohort 4
// requirements per dispatch §C.6 — JS uses `match: [/class/, /\s+/, IDENT_RE]`
// with `scope: {1: 'keyword', 3: 'title.class'}` and `variants: [...]` for
// alternatives like with-extends vs without. Spec §8.2.1.

import { describe, expect, it } from 'vitest';
import {
  type Mode,
  type TokenNode,
  type TokenScope,
  type TokenStream,
  createHighlighter,
  defineLanguage,
} from '../src/index.js';

type Event =
  | { kind: 'startScope'; scope: string }
  | { kind: 'endScope' }
  | { kind: 'text'; text: string };

function flatten(stream: TokenStream): readonly Event[] {
  const out: Event[] = [];
  walk(stream, out, false);
  return out;
}

function walk(node: TokenNode, out: Event[], emitRoot: boolean): void {
  if (node.type === 'text') {
    out.push({ kind: 'text', text: node.text });
    return;
  }
  if (node.type === 'sub-language') return;
  const scope = (node as TokenScope).scope;
  if (emitRoot && typeof scope === 'string') {
    out.push({ kind: 'startScope', scope });
  }
  for (const child of (node as TokenScope).children) {
    walk(child, out, true);
  }
  if (emitRoot && typeof scope === 'string') {
    out.push({ kind: 'endScope' });
  }
}

describe('multi-capture begin/match (spec §8.2.1)', () => {
  it('emits per-capture-group scopes when match is an array with scope ScopeMap', () => {
    const lang = defineLanguage({
      name: 'multi',
      contains: [
        {
          // class Foo  →  (class)(\s+)(Foo) with scope { 1: keyword, 3: title.class }
          match: [/class/, /\s+/, /[A-Za-z_][\w]*/],
          scope: { 1: 'keyword', 3: 'title.class' },
        },
      ],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('class Foo', { language: 'multi' });
    expect(r.illegal).toBe(false);
    const events = flatten(r._tokenStream!);
    // Expect: keyword 'class', text ' ', title.class 'Foo'.
    const scopes = events
      .filter((e) => e.kind === 'startScope')
      .map((e) => (e as { scope: string }).scope);
    expect(scopes).toContain('keyword');
    expect(scopes).toContain('title.class');
    // Render the final value contains both class names.
    expect(r.value).toContain('class');
    expect(r.value).toContain('Foo');
  });

  it('emits per-capture-group scopes via beginScope when no scope is present', () => {
    const lang = defineLanguage({
      name: 'multi-bs',
      contains: [
        {
          begin: [/function/, /\s+/, /[A-Za-z_]\w*/],
          beginScope: { 1: 'keyword', 3: 'title.function' },
          end: /\(/,
        },
      ],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('function bar(', { language: 'multi-bs' });
    expect(r.illegal).toBe(false);
    const events = flatten(r._tokenStream!);
    const scopes = events
      .filter((e) => e.kind === 'startScope')
      .map((e) => (e as { scope: string }).scope);
    expect(scopes).toContain('keyword');
    expect(scopes).toContain('title.function');
  });

  it('skips groups whose scope index is missing from the map (no wrap)', () => {
    const lang = defineLanguage({
      name: 'multi-skip',
      contains: [
        {
          match: [/class/, /\s+/, /[A-Z]\w*/],
          // Only group 1 + 3 mapped. Group 2 (\s+) is plain text.
          scope: { 1: 'keyword', 3: 'title.class' },
        },
      ],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('class Bar', { language: 'multi-skip' });
    expect(r.illegal).toBe(false);
    // The whitespace between class and Bar should be present as plain text.
    expect(r.value).toContain(' ');
  });
});

describe('variants expansion (spec §9.4 — upstream expandOrCloneMode)', () => {
  it('expands a mode with variants into N sibling modes at compile time', () => {
    const lang = defineLanguage({
      name: 'var-lang',
      contains: [
        {
          // Mode with two variants — one matches `foo`, one matches `bar`.
          variants: [
            { scope: 'foo-scope', begin: /foo/ },
            { scope: 'bar-scope', begin: /bar/ },
          ],
        } as Mode,
      ],
    });
    const hl = createHighlighter({ languages: [lang] });

    const r1 = hl.highlight('foo', { language: 'var-lang' });
    expect(r1.illegal).toBe(false);
    const events1 = flatten(r1._tokenStream!);
    const scopes1 = events1
      .filter((e) => e.kind === 'startScope')
      .map((e) => (e as { scope: string }).scope);
    expect(scopes1).toContain('foo-scope');

    const r2 = hl.highlight('bar', { language: 'var-lang' });
    expect(r2.illegal).toBe(false);
    const events2 = flatten(r2._tokenStream!);
    const scopes2 = events2
      .filter((e) => e.kind === 'startScope')
      .map((e) => (e as { scope: string }).scope);
    expect(scopes2).toContain('bar-scope');
  });

  it('variant fields override parent fields (relevance, scope)', () => {
    const lang = defineLanguage({
      name: 'var-override',
      contains: [
        {
          // Parent declares relevance:5, scope:'parent-scope'; the variant
          // overrides scope to 'variant-scope' but keeps relevance.
          relevance: 5,
          scope: 'parent-scope',
          variants: [{ scope: 'variant-scope', begin: /xyz/ }],
        } as Mode,
      ],
    });
    const hl = createHighlighter({ languages: [lang] });
    const r = hl.highlight('xyz', { language: 'var-override' });
    expect(r.illegal).toBe(false);
    const scopes = flatten(r._tokenStream!)
      .filter((e) => e.kind === 'startScope')
      .map((e) => (e as { scope: string }).scope);
    expect(scopes).toContain('variant-scope');
    expect(scopes).not.toContain('parent-scope');
  });
});
