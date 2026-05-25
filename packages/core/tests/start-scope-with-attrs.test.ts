// core 0.2.0 — `startScopeWithAttrs` plumbing (spec §13.3a, decision (a)).
//
// Proves the backward-compatible attribute-aware scope path:
//   1. A Mode carrying a static `attrs` payload routes through
//      `Emitter.startScopeWithAttrs(scope, attrs)` when the emitter implements
//      that optional method — the exact payload is forwarded.
//   2. The SAME language + the SAME mode degrade gracefully to
//      `Emitter.startScope(scope)` when the emitter does NOT implement the
//      optional method (existing emitters: emitters-html, recording).
//   3. A Mode WITHOUT `attrs` always takes the plain `startScope` path, even
//      when the emitter implements `startScopeWithAttrs` — so existing
//      highlighting languages are unaffected.

import { describe, expect, it } from 'vitest';
import {
  type Emitter,
  type EmitterFactory,
  type TokenStream,
  createHighlighter,
  defineEmitter,
  defineLanguage,
} from '../src/index.js';

type Call =
  | { kind: 'startScope'; scope: string }
  | { kind: 'startScopeWithAttrs'; scope: string; attrs: Readonly<Record<string, string>> }
  | { kind: 'endScope' }
  | { kind: 'addText'; text: string };

const EMPTY_STREAM: TokenStream = { type: 'scope', children: [] };

/** Emitter that DOES implement the optional `startScopeWithAttrs`. */
function attrAwareEmitter(): {
  factory: EmitterFactory<Call[]>;
  getLog(): readonly Call[];
} {
  let captured: Call[] | undefined;
  const factory = defineEmitter<Call[]>({
    name: 'attr-aware',
    create(): Emitter<Call[]> {
      const log: Call[] = [];
      captured = log;
      return {
        startScope: (scope) => log.push({ kind: 'startScope', scope }),
        startScopeWithAttrs: (scope, attrs) =>
          log.push({ kind: 'startScopeWithAttrs', scope, attrs }),
        endScope: () => log.push({ kind: 'endScope' }),
        addText: (text) => log.push({ kind: 'addText', text }),
        addSubLanguage: () => {},
        finalize: () => {},
        render: () => log,
        toTokenStream: () => EMPTY_STREAM,
      };
    },
  });
  return {
    factory,
    getLog() {
      if (captured === undefined) throw new Error('emitter never created');
      return captured;
    },
  };
}

/** Emitter that does NOT implement the optional `startScopeWithAttrs`. */
function plainEmitter(): { factory: EmitterFactory<Call[]>; getLog(): readonly Call[] } {
  let captured: Call[] | undefined;
  const factory = defineEmitter<Call[]>({
    name: 'plain',
    create(): Emitter<Call[]> {
      const log: Call[] = [];
      captured = log;
      // Note: NO startScopeWithAttrs member — mirrors emitters-html.
      return {
        startScope: (scope) => log.push({ kind: 'startScope', scope }),
        endScope: () => log.push({ kind: 'endScope' }),
        addText: (text) => log.push({ kind: 'addText', text }),
        addSubLanguage: () => {},
        finalize: () => {},
        render: () => log,
        toTokenStream: () => EMPTY_STREAM,
      };
    },
  });
  return {
    factory,
    getLog() {
      if (captured === undefined) throw new Error('emitter never created');
      return captured;
    },
  };
}

describe('Emitter.startScopeWithAttrs plumbing (spec §13.3a / core 0.2.0)', () => {
  // A mode that carries a static attribute payload.
  const linkLang = defineLanguage({
    name: 'attr-lang',
    contains: [
      {
        scope: 'link',
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
        attrs: { href: 'https://example.com', rel: 'noopener' },
      },
    ],
  });

  it('routes through startScopeWithAttrs and forwards the exact payload', () => {
    const { factory, getLog } = attrAwareEmitter();
    const hl = createHighlighter({ languages: [linkLang], emitter: factory });
    hl.highlight('[hi]', { language: 'attr-lang' });

    const log = getLog();
    const attrCall = log.find((c) => c.kind === 'startScopeWithAttrs');
    expect(attrCall).toEqual({
      kind: 'startScopeWithAttrs',
      scope: 'link',
      attrs: { href: 'https://example.com', rel: 'noopener' },
    });
    // It must NOT also fire the plain startScope for the same mode.
    expect(log.some((c) => c.kind === 'startScope')).toBe(false);
    expect(log.some((c) => c.kind === 'addText' && c.text === 'hi')).toBe(true);
  });

  it('falls back to startScope when the emitter omits the optional method', () => {
    const { factory, getLog } = plainEmitter();
    const hl = createHighlighter({ languages: [linkLang], emitter: factory });
    hl.highlight('[hi]', { language: 'attr-lang' });

    const log = getLog();
    // Backward-compatible: the attrs-bearing mode degrades to startScope.
    expect(log.some((c) => c.kind === 'startScope' && c.scope === 'link')).toBe(true);
    expect(log.some((c) => c.kind === 'startScopeWithAttrs')).toBe(false);
    expect(log.some((c) => c.kind === 'addText' && c.text === 'hi')).toBe(true);
  });

  it('a mode WITHOUT attrs always uses plain startScope, even on an attr-aware emitter', () => {
    const plainScopeLang = defineLanguage({
      name: 'plain-scope-lang',
      contains: [{ scope: 'kw', begin: /a/ }],
    });
    const { factory, getLog } = attrAwareEmitter();
    const hl = createHighlighter({ languages: [plainScopeLang], emitter: factory });
    hl.highlight('a', { language: 'plain-scope-lang' });

    const log = getLog();
    expect(log.some((c) => c.kind === 'startScope' && c.scope === 'kw')).toBe(true);
    expect(log.some((c) => c.kind === 'startScopeWithAttrs')).toBe(false);
  });
});
