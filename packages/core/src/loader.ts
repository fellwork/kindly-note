// Language-loader contract. spec §4.2.1 normative interface.
//
// This module defines the SHARED loader interface that the two v0 loader
// packages (`@kindly-note/loader-dynamic-import`, `@kindly-note/loader-fetch`)
// implement, plus the JSON-serialization shape used by `loader-fetch` to
// transport pre-serialized `LanguageDefinition` artifacts over the wire.
//
// Spec citations:
//   - §4.2.1 — `LanguageLoader` contract: `load(identifier): Promise<LanguageDefinition>`.
//     The interface lives in `@kindly-note/core` so both loader packages
//     depend on the same nominal type. Per dispatch §C: "`LanguageLoader`
//     interface is shared between the two packages (both export the same
//     type or both implement a common type from `@kindly-note/core`)."
//   - §4.2.3 — `SerializedLanguageDefinition`: a JSON-shaped artifact whose
//     `RegExp` values are encoded as `{ __type: 'regexp', source, flags }`.
//     v0 ships the deserializer (used by `loader-fetch`); the symmetric
//     serializer is opt-in tooling (per dispatch §9 note: "v0 doesn't need a
//     serializer tool, just the loader").
//   - §9 — Compilation timing: a loaded `LanguageDefinition` is registered
//     into a `Highlighter` via `createHighlighter({ languages: [...] })`,
//     where `compileLanguage` runs as normal. The fetch loader does NOT
//     pre-compile; it merely deserializes the typed `LanguageDefinition`.
//
// v0 minimal surface: this module exposes the loader interface, the serialized
// JSON shape, and a deserializer. The two loader implementations live in
// their own packages.

import { LanguageLoadError } from './errors.js';
import type { LanguageDefinition, Mode, ScopeMap } from './language.js';
import type { RegexLike } from './regex.js';

// ---------------------------------------------------------------------------
// Public loader contract
// ---------------------------------------------------------------------------

/**
 * The shared loader contract — spec §4.2.1.
 *
 * Implementations resolve a language identifier (a package name, a URL slug,
 * or a registry key) to a deep-frozen `LanguageDefinition`. Callers are
 * agnostic to what the identifier means.
 *
 * Per dispatch §C, the loader's `load()` returns `LanguageDefinition<unknown>`
 * (the parameter `TExtensible` is erased at the loader boundary; users who
 * need typed extension surfaces should static-import the language package).
 */
export interface LanguageLoader {
  /**
   * Resolve a language identifier to a deep-frozen `LanguageDefinition`.
   * Throws `LanguageLoadError` (re-exported from `@kindly-note/core/errors`)
   * if the identifier cannot be resolved or the loaded artifact has the
   * wrong shape.
   */
  load(specifier: string): Promise<LanguageDefinition<unknown>>;
}

// ---------------------------------------------------------------------------
// Serialization shape — spec §4.2.3
// ---------------------------------------------------------------------------

/**
 * JSON-shape envelope for a serialized `LanguageDefinition`. The format is
 * versioned (`format: 'kindly-note/v0'`) so future shape changes can ship
 * without breaking deployed CDN artifacts.
 *
 * Spec §4.2.3 names this `SerializedLanguageDefinition`. v0 simplifies the
 * spec slightly: the serialized form is the source `LanguageDefinition` JSON,
 * not the fully compiled artifact. Compilation runs at register time
 * regardless (spec §9.1). This keeps the fetch payload small and lets
 * different consumers run different versions of `compileLanguage`. A
 * future precompiled-artifact format can ship under a new `format` tag
 * without breaking the v0 envelope.
 */
export interface SerializedLanguageDefinition {
  readonly format: 'kindly-note/v0';
  /**
   * The serialized `LanguageDefinition` body. Every field whose runtime type
   * is `RegExp` is encoded as `SerializedRegExp` (`{ __type: 'regexp', source,
   * flags }`); everything else is plain JSON.
   */
  readonly definition: SerializedLanguageBody;
}

/**
 * A `RegExp` encoded as JSON — `__type: 'regexp'` is the discriminator that
 * `deserializeLanguage` looks for during the walk.
 */
export interface SerializedRegExp {
  readonly __type: 'regexp';
  readonly source: string;
  readonly flags?: string;
}

/**
 * The JSON-shape body of a `LanguageDefinition`. Fields mirror
 * `LanguageDefinition` but `RegExp` slots are `SerializedRegExp`-or-string
 * instead of `RegExp`-or-string.
 *
 * Note: `compilerExtensions` and `emitTokens` are functions — they are NOT
 * serializable. A serialized language SHALL NOT use either; they're omitted
 * from the body interface entirely.
 */
export interface SerializedLanguageBody {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly disableAutodetect?: boolean;
  readonly supersetOf?: string;
  readonly caseInsensitive?: boolean;
  readonly keywords?: SerializedKeywords;
  readonly contains: readonly SerializedMode[];
  readonly illegal?: SerializedRegexLike | readonly SerializedRegexLike[];
  readonly classNameAliases?: Readonly<Record<string, string>>;
}

export type SerializedRegexLike = string | SerializedRegExp;

export type SerializedKeywords =
  | string
  | readonly string[]
  | (Readonly<Record<string, string | readonly string[]>> & {
      readonly $pattern?: SerializedRegexLike;
    });

export interface SerializedMode {
  readonly label?: string;
  readonly scope?: string | ScopeMap;
  readonly className?: string;
  readonly begin?: SerializedRegexLike | readonly SerializedRegexLike[];
  readonly match?: SerializedRegexLike | readonly SerializedRegexLike[];
  readonly end?: SerializedRegexLike | readonly SerializedRegexLike[];
  readonly beginScope?: string | ScopeMap;
  readonly endScope?: string | ScopeMap;
  readonly contains?: readonly (SerializedMode | 'self')[];
  readonly variants?: readonly SerializedMode[];
  readonly keywords?: SerializedKeywords;
  readonly beginKeywords?: string;
  readonly lexemes?: SerializedRegexLike;
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
  readonly illegal?: SerializedRegexLike | readonly SerializedRegexLike[];
  readonly starts?: SerializedMode;
}

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

/**
 * Reconstruct a `LanguageDefinition` from its serialized JSON form. The
 * result is NOT yet deep-frozen — callers should pass it through
 * `defineLanguage()` (or `deepFreezeLanguage()`) to obtain the runtime-frozen
 * value. The `loader-fetch` loader does this freeze step before returning.
 *
 * The walk is structural: each `RegExp`-shaped slot is rebuilt; unknown fields
 * pass through unchanged. Throws `LanguageLoadError` (from `errors.ts`) when
 * the input is shape-invalid (missing `format`, missing `definition.name`,
 * non-array `contains`, etc.).
 */
export function deserializeLanguage(input: unknown): LanguageDefinition<unknown> {
  if (input === null || typeof input !== 'object') {
    throw new LanguageLoadError('<deserialize>', 'payload is not an object');
  }
  const env = input as Record<string, unknown>;
  if (env.format !== 'kindly-note/v0') {
    throw new LanguageLoadError(
      '<deserialize>',
      `unrecognized format: ${JSON.stringify(env.format)}`,
    );
  }
  const body = env.definition;
  if (body === null || typeof body !== 'object') {
    throw new LanguageLoadError('<deserialize>', 'definition body missing or not an object');
  }
  const def = body as SerializedLanguageBody;
  if (typeof def.name !== 'string' || def.name.length === 0) {
    throw new LanguageLoadError('<deserialize>', 'definition.name must be a non-empty string');
  }
  if (!Array.isArray(def.contains)) {
    throw new LanguageLoadError(def.name, 'definition.contains must be an array');
  }

  // Build a plain object — we DO NOT call defineLanguage() here so callers
  // can decide whether to freeze (the fetch loader freezes; tests may want
  // the raw value for inspection).
  const result: {
    -readonly [K in keyof LanguageDefinition<unknown>]: LanguageDefinition<unknown>[K];
  } = {
    name: def.name,
    contains: def.contains.map((m) => deserializeMode(m, def.name)),
  };
  if (def.aliases !== undefined) result.aliases = def.aliases;
  if (def.disableAutodetect !== undefined) result.disableAutodetect = def.disableAutodetect;
  if (def.supersetOf !== undefined) result.supersetOf = def.supersetOf;
  if (def.caseInsensitive !== undefined) result.caseInsensitive = def.caseInsensitive;
  if (def.keywords !== undefined) result.keywords = deserializeKeywords(def.keywords, def.name);
  if (def.illegal !== undefined) result.illegal = deserializeRegexOrArray(def.illegal, def.name);
  if (def.classNameAliases !== undefined) result.classNameAliases = def.classNameAliases;

  return result as LanguageDefinition<unknown>;
}

function deserializeMode(input: SerializedMode | 'self', langName: string): Mode {
  if (input === 'self') {
    throw new LanguageLoadError(
      langName,
      "'self' marker is only valid inside a contains array, not at the top level",
    );
  }
  if (input === null || typeof input !== 'object') {
    throw new LanguageLoadError(langName, 'mode is not an object');
  }
  const m = input as SerializedMode;
  const out: { -readonly [K in keyof Mode]: Mode[K] } = {};
  if (m.label !== undefined) out.label = m.label;
  if (m.scope !== undefined) out.scope = m.scope;
  if (m.className !== undefined) out.className = m.className;
  if (m.begin !== undefined) out.begin = deserializeRegexOrArray(m.begin, langName);
  if (m.match !== undefined) out.match = deserializeRegexOrArray(m.match, langName);
  if (m.end !== undefined) out.end = deserializeRegexOrArray(m.end, langName);
  if (m.beginScope !== undefined) out.beginScope = m.beginScope;
  if (m.endScope !== undefined) out.endScope = m.endScope;
  if (m.contains !== undefined) {
    out.contains = m.contains.map((c) => (c === 'self' ? 'self' : deserializeMode(c, langName)));
  }
  if (m.variants !== undefined) {
    out.variants = m.variants.map((v) => deserializeMode(v, langName));
  }
  if (m.keywords !== undefined) out.keywords = deserializeKeywords(m.keywords, langName);
  if (m.beginKeywords !== undefined) out.beginKeywords = m.beginKeywords;
  if (m.lexemes !== undefined) out.lexemes = deserializeRegex(m.lexemes, langName);
  if (m.relevance !== undefined) out.relevance = m.relevance;
  if (m.endsParent !== undefined) out.endsParent = m.endsParent;
  if (m.endsWithParent !== undefined) out.endsWithParent = m.endsWithParent;
  if (m.endSameAsBegin !== undefined) out.endSameAsBegin = m.endSameAsBegin;
  if (m.excludeBegin !== undefined) out.excludeBegin = m.excludeBegin;
  if (m.excludeEnd !== undefined) out.excludeEnd = m.excludeEnd;
  if (m.returnBegin !== undefined) out.returnBegin = m.returnBegin;
  if (m.returnEnd !== undefined) out.returnEnd = m.returnEnd;
  if (m.skip !== undefined) out.skip = m.skip;
  if (m.subLanguage !== undefined) out.subLanguage = m.subLanguage;
  if (m.illegal !== undefined) out.illegal = deserializeRegexOrArray(m.illegal, langName);
  if (m.starts !== undefined) out.starts = deserializeMode(m.starts, langName);
  return out;
}

function deserializeRegex(input: SerializedRegexLike, langName: string): RegexLike {
  if (typeof input === 'string') return input;
  if (input === null || typeof input !== 'object') {
    throw new LanguageLoadError(
      langName,
      `regex value must be a string or { __type: 'regexp', ... }, got ${typeof input}`,
    );
  }
  const r = input as SerializedRegExp;
  if (r.__type !== 'regexp' || typeof r.source !== 'string') {
    throw new LanguageLoadError(
      langName,
      "regex object must shape `{ __type: 'regexp', source: string, flags?: string }`",
    );
  }
  return new RegExp(r.source, r.flags ?? '');
}

function deserializeRegexOrArray(
  input: SerializedRegexLike | readonly SerializedRegexLike[],
  langName: string,
): RegexLike | readonly RegexLike[] {
  if (Array.isArray(input)) {
    return input.map((r) => deserializeRegex(r, langName));
  }
  return deserializeRegex(input as SerializedRegexLike, langName);
}

function deserializeKeywords(input: SerializedKeywords, langName: string): Mode['keywords'] {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) return input as readonly string[];
  if (input === null || typeof input !== 'object') {
    throw new LanguageLoadError(
      langName,
      `keywords must be a string, array, or object; got ${typeof input}`,
    );
  }
  // Object form. $pattern (if present) is a SerializedRegexLike; the rest
  // are string|readonly string[]. We rebuild the object so the $pattern is
  // a proper RegexLike.
  const src = input as Readonly<Record<string, unknown>>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (key === '$pattern') {
      out[key] = deserializeRegex(v as SerializedRegexLike, langName);
    } else {
      out[key] = v;
    }
  }
  return out as Mode['keywords'];
}
