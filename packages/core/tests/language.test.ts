// Tests for defineLanguage, extendLanguage. The keystone (spec section 8.2).
import { describe, expect, it } from 'vitest';
import {
  type LanguageDefinition,
  type Mode,
  defineLanguage,
  extendLanguage,
} from '../src/index.js';

describe('defineLanguage', () => {
  it('returns a deep-frozen LanguageDefinition', () => {
    const lang = defineLanguage({
      name: 'tiny',
      contains: [{ scope: 'kw', begin: /a/ }],
    });
    expect(Object.isFrozen(lang)).toBe(true);
    expect(Object.isFrozen(lang.contains)).toBe(true);
    expect(Object.isFrozen(lang.contains[0])).toBe(true);
  });

  it('preserves typed extensible field through freezing', () => {
    interface FooPoints {
      readonly FOO: readonly Mode[];
    }
    const FOO_MODES: readonly Mode[] = Object.freeze([
      Object.freeze({ scope: 'kw', begin: /alpha/, label: 'foo-alpha' }),
    ]);
    const lang = defineLanguage<FooPoints>({
      name: 'parent',
      contains: [],
      extensible: { FOO: FOO_MODES },
    });
    expect(lang.extensible?.FOO).toBe(FOO_MODES);
    expect(Object.isFrozen(lang.extensible)).toBe(true);
  });
});

describe('extendLanguage — the keystone (spec §8.2)', () => {
  // Acceptance test #1 from dispatch sec D.
  interface FooPoints {
    readonly FOO: readonly Mode[];
  }

  const NEW_MODE: Mode = { scope: 'literal', begin: /x/, label: 'new-mode' };

  function makeParent(): LanguageDefinition<FooPoints> {
    return defineLanguage<FooPoints>({
      name: 'parent',
      contains: [{ scope: 'kw', begin: /a/, label: 'kw-a' }],
      extensible: {
        FOO: [
          { scope: 'string', begin: /"/, label: 'foo-str' },
          { scope: 'number', begin: /\d/, label: 'foo-num' },
        ],
      },
    });
  }

  it('child has the new mode in the relevant location', () => {
    const parent = makeParent();
    const originalFooLength = parent.extensible!.FOO.length;
    const child = extendLanguage(parent, {
      name: 'child',
      extendPoints: {
        FOO: (cur) => [...cur, NEW_MODE],
      },
    });
    const childExt = child.extensible as FooPoints;
    expect(childExt.FOO.length).toBe(originalFooLength + 1);
    expect(childExt.FOO[childExt.FOO.length - 1]).toEqual(NEW_MODE);
    // First two are still the parent's modes (structural sharing or equal-by-value).
    expect(childExt.FOO[0]?.label).toBe('foo-str');
    expect(childExt.FOO[1]?.label).toBe('foo-num');
  });

  it("parent's extensible.FOO is unchanged after extend", () => {
    const parent = makeParent();
    const beforeSnapshot: readonly Mode[] = [...parent.extensible!.FOO];
    extendLanguage(parent, {
      name: 'child',
      extendPoints: { FOO: (cur) => [...cur, NEW_MODE] },
    });
    expect(parent.extensible!.FOO.length).toBe(beforeSnapshot.length);
    for (let i = 0; i < beforeSnapshot.length; i++) {
      expect(parent.extensible!.FOO[i]).toBe(beforeSnapshot[i]);
    }
  });

  it("parent's extensible.FOO is frozen — runtime push throws", () => {
    const parent = makeParent();
    // TypeScript also forbids this through `readonly Mode[]`; the runtime check
    // confirms deep freeze. (spec §9.1: deep-frozen, never mutated.)
    expect(() => {
      // Cast to circumvent TS for the runtime check.
      (parent.extensible!.FOO as Mode[]).push(NEW_MODE);
    }).toThrow();
  });

  it('child name and aliases come from extensions, not parent', () => {
    const parent = makeParent();
    const child = extendLanguage(parent, {
      name: 'child',
      aliases: ['c'],
    });
    expect(child.name).toBe('child');
    expect(child.aliases).toEqual(['c']);
  });

  it('replaceModes replaces a mode by label', () => {
    const parent = defineLanguage({
      name: 'p',
      contains: [
        { scope: 'kw', begin: /old/, label: 'target' },
        { scope: 'kw', begin: /keep/, label: 'untouched' },
      ],
    });
    const child = extendLanguage(parent, {
      name: 'c',
      replaceModes: [
        { label: 'target', with: { scope: 'literal', begin: /new/, label: 'target' } },
      ],
    });
    const replaced = child.contains[0]!;
    expect(replaced.scope).toBe('literal');
    expect(replaced.begin).toBeInstanceOf(RegExp);
    // untouched mode passed through.
    expect(child.contains[1]?.label).toBe('untouched');
  });

  it('addContains appends new modes', () => {
    const parent = defineLanguage({ name: 'p', contains: [{ scope: 'a', begin: /a/ }] });
    const child = extendLanguage(parent, {
      name: 'c',
      addContains: [{ scope: 'b', begin: /b/ }],
    });
    expect(child.contains).toHaveLength(2);
    expect(child.contains[1]?.scope).toBe('b');
  });

  it('extendKeywords merges parent and child keyword lists', () => {
    const parent = defineLanguage({
      name: 'p',
      contains: [],
      keywords: { keyword: ['foo', 'bar'] },
    });
    const child = extendLanguage(parent, {
      name: 'c',
      extendKeywords: { keyword: ['baz'] },
    });
    const childKw = child.keywords as Record<string, readonly string[]>;
    expect(new Set(childKw.keyword)).toEqual(new Set(['foo', 'bar', 'baz']));
  });

  it('throws when extending a parent that does not declare extensible', () => {
    const parent = defineLanguage({ name: 'p', contains: [] });
    expect(() =>
      extendLanguage(parent as LanguageDefinition<{ FOO: readonly Mode[] }>, {
        name: 'c',
        extendPoints: { FOO: (cur) => [...cur] },
      }),
    ).toThrow(/does not declare an `extensible`/);
  });
});
