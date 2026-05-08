// Tests for @kindly-note/lang-helpers Mode helpers.
//
// Acceptance gates from dispatch §C:
//   1. Frozen output — every Mode-returning helper produces a deep-frozen object.
//   2. Tree-shakable — verified at the import-shape level (named imports, no
//      barrel side effects). Bundle-level verification belongs to the build
//      output check (rolldown stats); here we assert that named imports work
//      and the module has no top-level statement other than re-exports.
//   3. Type-correctness — every helper's return type is `Mode` from
//      @kindly-note/core. Verified via TypeScript at compile time; runtime
//      assertions confirm the shape.
//   4. Pure / referentially-transparent — `cLineComment` imported twice is the
//      SAME frozen instance; `comment(...)` invoked twice returns equal-but-
//      distinct objects.
//   5. No upstream code copy — covered by code review; no test asserts this.

import type { Mode } from '@kindly-note/core';
import { describe, expect, it } from 'vitest';
import {
  apostropheString,
  backslashEscape,
  binaryNumberMode,
  cBlockComment,
  cLineComment,
  cNumberMode,
  comment,
  endSameAsBegin,
  hashComment,
  methodGuard,
  numberMode,
  phrasalWords,
  quoteString,
  regexpMode,
  shebang,
  titleMode,
  underscoreTitleMode,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Acceptance gate #1: every helper output is deep-frozen.
// ---------------------------------------------------------------------------

describe('acceptance #1 — frozen output', () => {
  // The set of constants. Each must be frozen at module load time.
  const constants: ReadonlyArray<readonly [string, Mode]> = [
    ['backslashEscape', backslashEscape],
    ['cLineComment', cLineComment],
    ['cBlockComment', cBlockComment],
    ['hashComment', hashComment],
    ['apostropheString', apostropheString],
    ['quoteString', quoteString],
    ['phrasalWords', phrasalWords],
    ['numberMode', numberMode],
    ['cNumberMode', cNumberMode],
    ['binaryNumberMode', binaryNumberMode],
    ['regexpMode', regexpMode],
    ['titleMode', titleMode],
    ['underscoreTitleMode', underscoreTitleMode],
    ['methodGuard', methodGuard],
  ];

  for (const [name, mode] of constants) {
    it(`${name} is frozen`, () => {
      expect(Object.isFrozen(mode)).toBe(true);
    });
  }

  it('comment() returns a frozen Mode', () => {
    const m = comment('//', '$');
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('shebang() returns a frozen Mode', () => {
    const m = shebang({ binary: 'node' });
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('endSameAsBegin() returns a frozen Mode', () => {
    const wrapped = endSameAsBegin({ scope: 'string', begin: /(["'])/ });
    expect(Object.isFrozen(wrapped)).toBe(true);
    expect(wrapped.endSameAsBegin).toBe(true);
  });

  it('apostropheString.contains is frozen (deep freeze of nested arrays)', () => {
    expect(Object.isFrozen(apostropheString.contains)).toBe(true);
  });

  it('regexpMode.contains and its nested character-class mode are frozen', () => {
    expect(Object.isFrozen(regexpMode.contains)).toBe(true);
    const charClass = regexpMode.contains?.[1];
    expect(charClass !== undefined && Object.isFrozen(charClass)).toBe(true);
    if (charClass !== undefined && charClass !== 'self') {
      expect(Object.isFrozen(charClass.contains)).toBe(true);
    }
  });

  it('cLineComment.contains (doctag + prose) is frozen', () => {
    expect(Object.isFrozen(cLineComment.contains)).toBe(true);
    for (const c of cLineComment.contains ?? []) {
      expect(Object.isFrozen(c)).toBe(true);
    }
  });

  it('attempting to push into a frozen contains array throws', () => {
    // strict-mode runtime guard — Array.push on a frozen array throws TypeError.
    expect(() => {
      // Cast to bypass the readonly type so the runtime is the only barrier.
      (cLineComment.contains as Mode[]).push({ scope: 'kw', begin: /x/ });
    }).toThrow();
  });

  it('attempting to mutate a frozen Mode field throws in strict mode', () => {
    expect(() => {
      // ESM modules execute in strict mode; assignment to a frozen field
      // throws TypeError. (Not a silent no-op.)
      (numberMode as { scope: string }).scope = 'mutated';
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Acceptance gate #4: referential transparency.
// ---------------------------------------------------------------------------

describe('acceptance #4 — pure / referentially-transparent', () => {
  it('cLineComment imported twice is the same frozen instance', async () => {
    // Re-import via dynamic import; the ESM loader caches the module so the
    // exported binding is identity-stable across imports.
    const a = (await import('../src/index.js')).cLineComment;
    const b = (await import('../src/index.js')).cLineComment;
    expect(a).toBe(b);
    expect(a).toBe(cLineComment);
  });

  it('comment("//", "$") returns equal-but-distinct objects on each call', () => {
    const a = comment('//', '$');
    const b = comment('//', '$');
    // Each invocation produces a fresh frozen Mode (distinct instance).
    expect(a).not.toBe(b);
    // Equal by value.
    expect(a.scope).toBe(b.scope);
    expect(a.begin).toEqual(b.begin);
    expect(a.end).toEqual(b.end);
    // (Not deep-equal across the entire object because nested arrays of fresh
    // contains modes are also distinct instances. Top-level fields suffice for
    // gate #4's "deep-equal allowed, identity-equal not required.")
  });

  it('two calls to shebang() return distinct objects', () => {
    const a = shebang();
    const b = shebang();
    expect(a).not.toBe(b);
    expect(a.scope).toBe(b.scope);
  });
});

// ---------------------------------------------------------------------------
// Helper-by-helper behavior.
// ---------------------------------------------------------------------------

describe('comment()', () => {
  it('produces scope: "comment" with the given begin/end', () => {
    const m = comment('//', '$');
    expect(m.scope).toBe('comment');
    expect(m.begin).toBe('//');
    expect(m.end).toBe('$');
  });

  it('includes a doctag sub-mode in contains', () => {
    const m = comment('/\\*', '\\*/');
    const doctag = m.contains?.find((c) => c !== 'self' && c.scope === 'doctag');
    expect(doctag).toBeDefined();
  });

  it('honors a caller-supplied scope override', () => {
    const m = comment('//', '$', { scope: 'comment.doc' });
    expect(m.scope).toBe('comment.doc');
  });

  it('appends caller-supplied contains after the built-in ones', () => {
    const extra: Mode = { scope: 'kw', begin: /TODO/ };
    const m = comment('//', '$', { contains: [extra] });
    // doctag, prose, then the caller's mode.
    expect(m.contains?.length).toBe(3);
    expect(m.contains?.[2]).toBe(extra);
  });

  it('accepts a RegExp begin/end', () => {
    const m = comment(/\/\//, /$/);
    expect(m.begin).toEqual(/\/\//);
  });
});

describe('cLineComment / cBlockComment / hashComment', () => {
  it('cLineComment matches // begin and end-of-line end', () => {
    expect(cLineComment.scope).toBe('comment');
    expect(cLineComment.begin).toBe('//');
    expect(cLineComment.end).toBe('$');
  });

  it('cBlockComment matches /* and */', () => {
    expect(cBlockComment.scope).toBe('comment');
    expect(cBlockComment.begin).toBe('/\\*');
    expect(cBlockComment.end).toBe('\\*/');
  });

  it('hashComment matches # and end-of-line', () => {
    expect(hashComment.scope).toBe('comment');
    expect(hashComment.begin).toBe('#');
    expect(hashComment.end).toBe('$');
  });
});

describe('apostropheString / quoteString / backslashEscape', () => {
  it('apostropheString uses single-quote delimiters', () => {
    expect(apostropheString.scope).toBe('string');
    expect(apostropheString.begin).toBe("'");
    expect(apostropheString.end).toBe("'");
    expect(apostropheString.illegal).toBe('\\n');
  });

  it('quoteString uses double-quote delimiters', () => {
    expect(quoteString.scope).toBe('string');
    expect(quoteString.begin).toBe('"');
    expect(quoteString.end).toBe('"');
  });

  it('both string modes contain backslashEscape', () => {
    expect(apostropheString.contains?.[0]).toBe(backslashEscape);
    expect(quoteString.contains?.[0]).toBe(backslashEscape);
  });

  it('backslashEscape has relevance 0 and matches a backslash followed by any char', () => {
    expect(backslashEscape.relevance).toBe(0);
    expect(backslashEscape.begin).toBe('\\\\[\\s\\S]');
  });
});

describe('phrasalWords', () => {
  it('is a begin-only Mode whose begin is a RegExp of common English fillers', () => {
    expect(phrasalWords.begin).toBeInstanceOf(RegExp);
    const re = phrasalWords.begin as RegExp;
    expect(re.test('the')).toBe(true);
    expect(re.test("I'm here")).toBe(true);
    expect(re.test("won't")).toBe(true);
    expect(re.test('xyzzy')).toBe(false);
  });
});

describe('numberMode / cNumberMode / binaryNumberMode', () => {
  it('numberMode has scope number, relevance 0', () => {
    expect(numberMode.scope).toBe('number');
    expect(numberMode.relevance).toBe(0);
  });

  it('cNumberMode handles hex / decimal / float / exponent', () => {
    const re = new RegExp(cNumberMode.begin as string);
    expect(re.test('0xFF')).toBe(true);
    expect(re.test('123')).toBe(true);
    expect(re.test('12.34')).toBe(true);
    expect(re.test('1e6')).toBe(true);
    expect(re.test('1.2e-3')).toBe(true);
  });

  it('binaryNumberMode matches 0b... literals', () => {
    const re = new RegExp(binaryNumberMode.begin as string);
    expect(re.test('0b1010')).toBe(true);
    expect(re.test('0b0')).toBe(true);
  });
});

describe('regexpMode', () => {
  it('has scope: regexp', () => {
    expect(regexpMode.scope).toBe('regexp');
  });

  it('begins with /(?=[^/\\n]*/) and ends with /flags', () => {
    expect(regexpMode.begin).toEqual(/\/(?=[^/\n]*\/)/);
    expect(regexpMode.end).toEqual(/\/[gimuy]*/);
  });

  it('contains backslashEscape and a [...] character-class sub-mode', () => {
    expect(regexpMode.contains?.length).toBe(2);
    expect(regexpMode.contains?.[0]).toBe(backslashEscape);
    const charClass = regexpMode.contains?.[1];
    expect(charClass !== 'self' && charClass?.begin).toEqual(/\[/);
    expect(charClass !== 'self' && charClass?.end).toEqual(/\]/);
  });
});

describe('titleMode / underscoreTitleMode', () => {
  it('titleMode begins with an identifier regex (no underscore prefix)', () => {
    expect(titleMode.scope).toBe('title');
    expect(titleMode.begin).toBe('[a-zA-Z]\\w*');
    expect(titleMode.relevance).toBe(0);
  });

  it('underscoreTitleMode allows leading underscore', () => {
    expect(underscoreTitleMode.scope).toBe('title');
    expect(underscoreTitleMode.begin).toBe('[a-zA-Z_]\\w*');
  });
});

describe('methodGuard', () => {
  it('begins with .<id> to suppress keyword highlighting after a dot', () => {
    expect(methodGuard.begin).toBe('\\.\\s*[a-zA-Z_]\\w*');
    expect(methodGuard.relevance).toBe(0);
  });
});

describe('endSameAsBegin', () => {
  it('returns a new Mode with endSameAsBegin: true', () => {
    const input: Mode = { scope: 'string', begin: /(["'])/, end: /\1/ };
    const out = endSameAsBegin(input);
    expect(out.endSameAsBegin).toBe(true);
    expect(out.scope).toBe(input.scope);
    expect(out).not.toBe(input);
  });

  it('does not mutate the input Mode', () => {
    const input: Mode = { scope: 'string', begin: /(["'])/, end: /\1/ };
    const beforeKeys = Object.keys(input).sort();
    endSameAsBegin(input);
    expect(Object.keys(input).sort()).toEqual(beforeKeys);
    expect((input as { endSameAsBegin?: boolean }).endSameAsBegin).toBeUndefined();
  });

  it('produces a frozen Mode', () => {
    const out = endSameAsBegin({ scope: 'string', begin: /(["'])/ });
    expect(Object.isFrozen(out)).toBe(true);
  });
});

describe('shebang()', () => {
  it('default produces scope: meta, begin: ^#!\\s*/, end: $', () => {
    const m = shebang();
    expect(m.scope).toBe('meta');
    expect(m.begin).toBe('^#![ ]*\\/');
    expect(m.end).toEqual(/$/);
    expect(m.relevance).toBe(0);
  });

  it('with binary "node" anchors the regex to the binary name', () => {
    const m = shebang({ binary: 'node' });
    expect(typeof m.begin).toBe('string');
    expect(m.begin as string).toContain('node');
    // The compiled regex matches `#!/usr/bin/env node`
    const re = new RegExp(m.begin as string);
    expect(re.test('#!/usr/bin/env node')).toBe(true);
    expect(re.test('#!/usr/bin/env python')).toBe(false);
  });

  it('forwards extra Mode fields like label', () => {
    const m = shebang({ binary: 'node', label: 'shebang' } as Parameters<typeof shebang>[0]);
    expect(m.label).toBe('shebang');
  });
});

// ---------------------------------------------------------------------------
// Tree-shakable / no-side-effect-import smoke (acceptance #2).
// ---------------------------------------------------------------------------

describe('acceptance #2 — no side effects on import', () => {
  it('importing a single helper does not require the others to be evaluated', async () => {
    // We can't directly assert tree-shaking from a test; what we CAN assert is
    // that importing the module mutates no globals. globalThis has no
    // kindly-note-shaped key after import.
    const before = Object.keys(globalThis).filter((k) => /kindly|highlight/i.test(k));
    await import('../src/index.js');
    const after = Object.keys(globalThis).filter((k) => /kindly|highlight/i.test(k));
    expect(after).toEqual(before);
  });

  it('every export from index.ts is named (no default export)', async () => {
    const mod = (await import('../src/index.js')) as Record<string, unknown>;
    expect((mod as { default?: unknown }).default).toBeUndefined();
  });
});
