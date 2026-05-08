// Language type system: Mode, Keywords, LanguageDefinition, defineLanguage,
// extendLanguage, LanguageExtensions. spec section 2.2 (Mode), section 8.2
// (THE KEYSTONE — extendLanguage), section 9 (compilation timing).
//
// Design constraints (from spec section 9.1):
//   1. LanguageDefinition is the immutable, typed source-of-truth value a
//      language package exports. It is deep-frozen at module-init time.
//   2. extendLanguage(parent, extensions) produces a NEW LanguageDefinition;
//      the parent is structurally shared (frozen) but never written to.
//   3. The keystone test in tests/language.test.ts verifies (a) child
//      contains the new modes; (b) parent's extensible is bit-for-bit
//      unchanged; (c) attempting to mutate frozen members throws.

import type { Emitter } from './emitter.js';
import { LanguageNotExtensibleError } from './errors.js';
import type { RegexLike } from './regex.js';

// ---------------------------------------------------------------------------
// Mode tree
// ---------------------------------------------------------------------------

/**
 * The author-facing keyword shape. Either a flat string list/string or a
 * categorised object. Maps to the matcher's KeywordDict during compilation.
 *
 * Categorical keys are scope names ('keyword', 'literal', 'built_in', etc.);
 * `$pattern` controls the lexeme tokenizer regex. Mirrors upstream.
 */
export type Keywords =
  | string
  | readonly string[]
  | (Readonly<Record<string, string | readonly string[]>> & {
      readonly $pattern?: RegexLike;
    });

/**
 * Scope assignment per capture group, by group index. The string '0' refers to
 * the whole match. Empty string omits the wrap. Mirrors upstream MultiClass.
 */
export type ScopeMap = Readonly<Record<number, string>>;

/**
 * The author-facing Mode shape. Most fields are optional; the matcher resolves
 * begin/match/end during compileLanguage.
 *
 * spec section 2.2 references this implicitly through `contains: readonly Mode[]`;
 * the upstream type lives in highlight.js types/index.d.ts ModeDetails. We
 * preserve the same fields with `readonly` markers and frozen arrays.
 */
export interface Mode {
  /** A semantic label used by extendLanguage's replaceModes / transformLabeledMode. */
  readonly label?: string;

  readonly scope?: string | ScopeMap;
  readonly className?: string; // deprecated alias for `scope`

  readonly begin?: RegexLike | readonly RegexLike[];
  readonly match?: RegexLike | readonly RegexLike[];
  readonly end?: RegexLike | readonly RegexLike[];

  readonly beginScope?: string | ScopeMap;
  readonly endScope?: string | ScopeMap;

  readonly contains?: readonly (Mode | 'self')[];
  readonly variants?: readonly Mode[];

  readonly keywords?: Keywords;
  readonly beginKeywords?: string;
  readonly lexemes?: RegexLike;

  readonly relevance?: number;

  readonly endsParent?: boolean;
  readonly endsWithParent?: boolean;
  readonly endSameAsBegin?: boolean;
  readonly excludeBegin?: boolean;
  readonly excludeEnd?: boolean;
  readonly returnBegin?: boolean;
  readonly returnEnd?: boolean;
  readonly skip?: boolean;

  readonly subLanguage?: string | readonly string[];

  readonly illegal?: RegexLike | readonly RegexLike[];

  readonly starts?: Mode;
}

/**
 * Author-facing compiler-extension function. spec section 7.3 row
 * "compilerExtensions". Receives a clone of the mode and the parent and may
 * augment the clone in place (it's a clone, the source mode is unchanged).
 * Returning a new mode object is also acceptable.
 */
export type CompilerExt = (mode: Mode, parent?: Mode) => Mode | undefined;

// ---------------------------------------------------------------------------
// LanguageDefinition + extension surface
// ---------------------------------------------------------------------------

/**
 * The deep-frozen language definition shape. spec section 8.2 normative type.
 *
 * Type parameter `TExtensible` is the typed extension surface this language
 * publishes. Defaults to `undefined`, meaning the language is final (cannot
 * be the target of extendLanguage). spec section 8.2.3 (Arduino vs C++) shows
 * the no-extensible case; spec section 8.2.1 (JS) shows the
 * `extensible: JavaScriptExtensionPoints` case.
 */
export interface LanguageDefinition<TExtensible = undefined> {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly disableAutodetect?: boolean;
  readonly supersetOf?: string;
  readonly caseInsensitive?: boolean;
  readonly keywords?: Keywords;
  readonly contains: readonly Mode[];
  readonly illegal?: RegexLike | readonly RegexLike[];
  readonly classNameAliases?: Readonly<Record<string, string>>;
  readonly compilerExtensions?: readonly CompilerExt[];
  /** Escape hatch — typed replacement for upstream's __emitTokens. spec section 7.3. */
  readonly emitTokens?: (code: string, emitter: Emitter<unknown>) => void;
  /** Typed extension surface published to descendants. spec section 8.2. */
  readonly extensible?: TExtensible;
}

/**
 * Identity factory. spec section 8.2 contract. The runtime shape is a deep-
 * frozen LanguageDefinition; the type signature flows TExtensible through.
 *
 * spec section 9.1: every LanguageDefinition is frozen at module-init time.
 * defineLanguage performs the freeze so language packages don't have to.
 */
export function defineLanguage<T = undefined>(def: LanguageDefinition<T>): LanguageDefinition<T> {
  return deepFreezeLanguage(def);
}

/**
 * Extension contract for extendLanguage. spec section 8.2 normative type.
 *
 * `TExt` is the parent's extensible shape. When TExt is `undefined`, the
 * `extendPoints` member is statically `never` — the parent did not publish
 * an extension surface, so descendants cannot reach into it.
 */
export interface LanguageExtensions<TExt> {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly supersetOf?: string;
  readonly caseInsensitive?: boolean;

  /** Append new modes to the parent's contains. spec section 8.2.2. */
  readonly addContains?: readonly Mode[];

  /** Replace modes by `label`. spec section 8.2.2. */
  readonly replaceModes?: ReadonlyArray<{
    readonly label: string;
    readonly with: Mode;
  }>;

  /** Merge keyword sets — typed shallow merge against parent.keywords. */
  readonly extendKeywords?: Keywords;

  /**
   * Type-safe access to parent's named extension points. The shape comes
   * from the parent's `extensible` declaration. Each known point produces
   * a new value (never mutates parent). spec section 8.2.
   */
  readonly extendPoints?: TExt extends object
    ? Partial<{ [K in keyof TExt]: (current: TExt[K]) => TExt[K] }>
    : never;

  /** Apply a function to a mode by label. spec section 8.2.2. */
  readonly transformLabeledMode?: ReadonlyArray<{
    readonly label: string;
    readonly transform: (mode: Mode) => Mode;
  }>;

  /** Override illegal patterns. */
  readonly illegal?: RegexLike | readonly RegexLike[];
}

/**
 * Produce a new LanguageDefinition that extends `parent`. spec section 8.2.
 *
 * Implementation contract:
 *   1. Parent is never mutated. Iteration walks parent.contains; the new
 *      contains array is fresh.
 *   2. Replacements honor `replaceModes` (label-keyed) and `transformLabeledMode`.
 *   3. New extensible is computed by composing extendPoints over the parent's
 *      extensible. Each point's transform receives the parent's frozen value.
 *   4. The resulting LanguageDefinition is itself deep-frozen.
 *
 * Note: extending requires the parent to declare an extensible field. If a
 * caller tries to use `extendPoints` against a parent with extensible: undefined,
 * the call fails at runtime with LanguageNotExtensibleError. (TypeScript also
 * catches this at the call site via the conditional `never` branch.)
 */
export function extendLanguage<TExt>(
  parent: LanguageDefinition<TExt>,
  extensions: LanguageExtensions<TExt>,
): LanguageDefinition<unknown> {
  // 1. Replace modes by label, then apply transformLabeledMode.
  const replaceMap = new Map<string, Mode>();
  for (const r of extensions.replaceModes ?? []) {
    replaceMap.set(r.label, r.with);
  }
  const transformMap = new Map<string, (m: Mode) => Mode>();
  for (const t of extensions.transformLabeledMode ?? []) {
    transformMap.set(t.label, t.transform);
  }

  const replacedContains: Mode[] = parent.contains.map((m) => {
    if (m.label !== undefined) {
      const replacement = replaceMap.get(m.label);
      if (replacement !== undefined) return replacement;
      const transform = transformMap.get(m.label);
      if (transform !== undefined) return transform(m);
    }
    return m;
  });

  // 2. Append new modes from addContains.
  const newContains: readonly Mode[] = [...replacedContains, ...(extensions.addContains ?? [])];

  // 3. Compose extensible — each point's transform takes the parent's frozen
  //    value and returns a new value (never mutates).
  let newExtensible: unknown = parent.extensible;
  if (extensions.extendPoints !== undefined && extensions.extendPoints !== null) {
    if (parent.extensible === undefined || parent.extensible === null) {
      // The conditional type (`never`) prevents this at TS time, but a runtime
      // guard is necessary because callers may use `as` casts.
      // spec section 8.2: a language must opt-in to being extended via `extensible`.
      throw new LanguageNotExtensibleError(parent.name);
    }
    const parentExt = parent.extensible as Record<string, unknown>;
    const points = extensions.extendPoints as Record<string, (current: unknown) => unknown>;
    const composed: Record<string, unknown> = { ...parentExt };
    for (const key of Object.keys(points)) {
      const transform = points[key];
      if (transform !== undefined) {
        composed[key] = transform(parentExt[key]);
      }
    }
    newExtensible = composed;
  }

  // 4. Merge keywords (shallow merge).
  const newKeywords =
    extensions.extendKeywords !== undefined
      ? mergeKeywords(parent.keywords, extensions.extendKeywords)
      : parent.keywords;

  // 5. Construct the child definition. Aliases default to empty (the parent's
  //    aliases belong to the parent — TypeScript doesn't claim 'js'.).
  // We assemble the definition without any optional-undefined keys so that
  // exactOptionalPropertyTypes-aware downstream code stays clean.
  const child: {
    -readonly [K in keyof LanguageDefinition<unknown>]: LanguageDefinition<unknown>[K];
  } = {
    name: extensions.name,
    contains: newContains,
  };
  if (extensions.aliases !== undefined) child.aliases = extensions.aliases;
  if (extensions.supersetOf !== undefined) child.supersetOf = extensions.supersetOf;
  else if (parent.supersetOf !== undefined) child.supersetOf = parent.supersetOf;
  if (extensions.caseInsensitive !== undefined) child.caseInsensitive = extensions.caseInsensitive;
  else if (parent.caseInsensitive !== undefined) child.caseInsensitive = parent.caseInsensitive;
  if (parent.disableAutodetect !== undefined) child.disableAutodetect = parent.disableAutodetect;
  if (newKeywords !== undefined) child.keywords = newKeywords;
  if (extensions.illegal !== undefined) child.illegal = extensions.illegal;
  else if (parent.illegal !== undefined) child.illegal = parent.illegal;
  if (parent.classNameAliases !== undefined) child.classNameAliases = parent.classNameAliases;
  if (parent.compilerExtensions !== undefined) child.compilerExtensions = parent.compilerExtensions;
  if (parent.emitTokens !== undefined) child.emitTokens = parent.emitTokens;
  if (newExtensible !== undefined && newExtensible !== null) child.extensible = newExtensible;

  return deepFreezeLanguage(child as LanguageDefinition<unknown>);
}

// ---------------------------------------------------------------------------
// Keyword merging
// ---------------------------------------------------------------------------

function mergeKeywords(parent: Keywords | undefined, child: Keywords): Keywords {
  // If either side is a string or array, normalize the parent into the
  // 'keyword' bucket and shallow-merge with the child.
  const parentObj = normalizeKeywords(parent);
  const childObj = normalizeKeywords(child);
  const out: Record<string, string | readonly string[]> = {};
  // Concat string-list values per key to reflect shallow merge intent
  // (spec section 8.2.2: "extendKeywords ... merged with parent").
  const allKeys = new Set([...Object.keys(parentObj), ...Object.keys(childObj)]);
  for (const k of allKeys) {
    const p = parentObj[k];
    const c = childObj[k];
    if (p === undefined) {
      if (c !== undefined) out[k] = c;
    } else if (c === undefined) {
      out[k] = p;
    } else {
      // Both present; concat-and-dedupe as arrays, preserving the union.
      const pl = typeof p === 'string' ? splitToList(p) : p;
      const cl = typeof c === 'string' ? splitToList(c) : c;
      out[k] = Array.from(new Set([...pl, ...cl]));
    }
  }
  return out;
}

function normalizeKeywords(k: Keywords | undefined): Record<string, string | readonly string[]> {
  if (k === undefined) return {};
  if (typeof k === 'string') return { keyword: k };
  if (Array.isArray(k)) return { keyword: k as readonly string[] };
  // Object — strip $pattern, copy the rest.
  const obj = k as Readonly<Record<string, string | readonly string[]>> & {
    readonly $pattern?: RegexLike;
  };
  const out: Record<string, string | readonly string[]> = {};
  for (const key of Object.keys(obj)) {
    if (key === '$pattern') continue;
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === 'string' || Array.isArray(v)) {
      out[key] = v as string | readonly string[];
    }
  }
  return out;
}

function splitToList(s: string): readonly string[] {
  return s
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

// ---------------------------------------------------------------------------
// Deep freeze
// ---------------------------------------------------------------------------

/**
 * Deep-freeze a language definition. spec section 9.1: language definitions
 * are deep-frozen and never mutated. Cycles are not permitted (a Mode tree is
 * acyclic by construction); we still guard against accidental cycles via a
 * visited set.
 */
export function deepFreezeLanguage<T>(def: LanguageDefinition<T>): LanguageDefinition<T> {
  deepFreeze(def, new WeakSet());
  return def;
}

function deepFreeze(value: unknown, seen: WeakSet<object>): void {
  if (value === null) return;
  if (typeof value !== 'object') return;
  // Skip RegExp — it is opaque, and freezing it has no effect anyway in V8.
  if (value instanceof RegExp) return;
  if (seen.has(value as object)) return;
  seen.add(value as object);
  // Visit children first, then freeze.
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key], seen);
  }
  // Freeze arrays' contents — already done by the loop above. Now freeze the
  // container itself.
  Object.freeze(value);
}
