// Compilation contract — spec section 9.4 normative.
//
// LanguageDefinition (frozen, source-of-truth) -> CompiledLanguage (frozen,
// engine-internal). Compilation happens at registerLanguage time. The raw
// definition is never mutated. spec section 9.1 / 9.2.
//
// v0 scope: the matcher is a minimal "first-match wins" walker over the
// flattened mode tree. It is sufficient for the keystone tests in tests/
// (a stub language, JSON-shaped tokens, label-replacement). Languages with
// complex multi-regex patterns will exercise compileLanguage further in
// later cohorts; the data shape we expose now leaves room for that.

import type { Emitter } from './emitter.js';
import type { CompilerExt, Keywords, LanguageDefinition, Mode, ScopeMap } from './language.js';
import { type RegexLike, source as regexSource } from './regex.js';

/**
 * Runtime-typed keyword dictionary. Maps a literal lexeme to its (scope, relevance)
 * pair. Mirrors upstream `KeywordDict` from highlight.js/private.
 */
export type KeywordDict = ReadonlyMap<string, readonly [scope: string, relevance: number]>;

/**
 * The compiled-and-frozen language artifact. spec section 9.4 normative.
 */
export interface CompiledLanguage {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly disableAutodetect: boolean;
  readonly supersetOf?: string;
  readonly emitTokens?: (code: string, emitter: Emitter<unknown>) => void;
  /** Pre-compiled root mode. Frozen. */
  readonly root: CompiledMode;
  /** The classNameAliases dictionary from the source definition (read-only). */
  readonly classNameAliases: Readonly<Record<string, string>>;
}

/**
 * Per-mode compiled artifact. Mirrors upstream CompiledMode but immutable.
 *
 * v0 keeps this lean — the matcher loop in `internal/matcher.ts` reads what
 * it needs. Later cohorts add multi-regex matchers, terminator strings, etc.
 */
export interface CompiledMode {
  readonly scope?: string;
  readonly label?: string;
  readonly beginRe?: RegExp;
  readonly endRe?: RegExp;
  readonly matchRe?: RegExp;
  readonly illegalRe?: RegExp;
  readonly keywords?: KeywordDict;
  readonly contains: readonly CompiledMode[];
  readonly subLanguage?: string | readonly string[];
  readonly relevance: number;
  readonly excludeBegin: boolean;
  readonly excludeEnd: boolean;
  readonly returnBegin: boolean;
  readonly returnEnd: boolean;
  readonly skip: boolean;
  readonly endsParent: boolean;
  readonly endsWithParent: boolean;
  readonly beginScope?: string | ScopeMap;
  readonly endScope?: string | ScopeMap;
}

// ---------------------------------------------------------------------------
// compileLanguage
// ---------------------------------------------------------------------------

/**
 * Compile a frozen LanguageDefinition into a frozen CompiledLanguage. Pure
 * function — given the same input twice, returns equal-but-not-identical
 * outputs. spec section 9.1.
 */
export function compileLanguage(def: LanguageDefinition<unknown>): CompiledLanguage {
  const compilerExtensions = def.compilerExtensions ?? [];

  const root = compileMode(
    {
      // The implicit root mode wraps the language's contains.
      contains: def.contains,
      keywords: def.keywords,
      illegal: def.illegal,
    },
    undefined,
    compilerExtensions,
    def.caseInsensitive ?? false,
  );

  const compiled: CompiledLanguage = {
    name: def.name,
    aliases: Object.freeze([...(def.aliases ?? [])]),
    disableAutodetect: def.disableAutodetect ?? false,
    classNameAliases: Object.freeze({ ...(def.classNameAliases ?? {}) }),
    root,
    ...(def.supersetOf !== undefined ? { supersetOf: def.supersetOf } : {}),
    ...(def.emitTokens !== undefined ? { emitTokens: def.emitTokens } : {}),
  };

  return Object.freeze(compiled);
}

function compileMode(
  mode: Mode,
  parent: Mode | undefined,
  exts: readonly CompilerExt[],
  caseInsensitive: boolean,
): CompiledMode {
  // Apply compilerExtensions to a shallow clone — the extensions may mutate
  // the clone in place, but the source mode is unchanged. spec section 9.4.
  const cloned: Mode = { ...mode };
  let mutable: Mode = cloned;
  for (const ext of exts) {
    const result = ext(mutable, parent);
    if (result !== undefined) mutable = result;
  }

  const beginPattern = pickPattern(mutable.begin ?? mutable.match);
  const endPattern = pickPattern(mutable.end);
  const illegalPattern = pickPattern(mutable.illegal);
  const matchPattern = pickPattern(mutable.match);

  // Respect beginKeywords by treating them as an alternation of literals
  // — anchored match for the keyword set. spec compatibility note: upstream
  // does the same in mode_compiler beginKeywords expansion.
  let effectiveBeginRe: RegExp | undefined;
  if (mutable.beginKeywords !== undefined && mutable.beginKeywords !== '') {
    const words = mutable.beginKeywords.split(/\s+/).filter((w) => w.length > 0);
    const alt = words.map(escapeForRegex).join('|');
    effectiveBeginRe = compileRe(`(?:${alt})\\b`, caseInsensitive);
  } else if (beginPattern !== undefined) {
    effectiveBeginRe = compileRe(beginPattern, caseInsensitive);
  }

  const compiledContains: readonly CompiledMode[] = Object.freeze(
    (mutable.contains ?? [])
      .filter((c): c is Mode => c !== 'self')
      .map((c) => compileMode(c, mutable, exts, caseInsensitive)),
  );

  const keywords = mutable.keywords !== undefined ? buildKeywordDict(mutable.keywords) : undefined;

  const compiled: CompiledMode = {
    contains: compiledContains,
    relevance: mutable.relevance ?? 1,
    excludeBegin: mutable.excludeBegin ?? false,
    excludeEnd: mutable.excludeEnd ?? false,
    returnBegin: mutable.returnBegin ?? false,
    returnEnd: mutable.returnEnd ?? false,
    skip: mutable.skip ?? false,
    endsParent: mutable.endsParent ?? false,
    endsWithParent: mutable.endsWithParent ?? false,
    ...(typeof mutable.scope === 'string' ? { scope: mutable.scope } : {}),
    ...(mutable.label !== undefined ? { label: mutable.label } : {}),
    ...(effectiveBeginRe !== undefined ? { beginRe: effectiveBeginRe } : {}),
    ...(endPattern !== undefined ? { endRe: compileRe(endPattern, caseInsensitive) } : {}),
    ...(matchPattern !== undefined && mutable.match !== undefined
      ? { matchRe: compileRe(matchPattern, caseInsensitive) }
      : {}),
    ...(illegalPattern !== undefined
      ? { illegalRe: compileRe(illegalPattern, caseInsensitive) }
      : {}),
    ...(keywords !== undefined ? { keywords } : {}),
    ...(mutable.subLanguage !== undefined ? { subLanguage: mutable.subLanguage } : {}),
    ...(mutable.beginScope !== undefined ? { beginScope: mutable.beginScope } : {}),
    ...(mutable.endScope !== undefined ? { endScope: mutable.endScope } : {}),
  };

  return Object.freeze(compiled);
}

function pickPattern(p: RegexLike | readonly RegexLike[] | undefined): string | undefined {
  if (p === undefined) return undefined;
  if (Array.isArray(p)) {
    if (p.length === 0) return undefined;
    return p.map(regexSource).join('|');
  }
  return regexSource(p as RegexLike);
}

function compileRe(pattern: string, caseInsensitive: boolean): RegExp {
  // 'g' so we can use lastIndex to walk through input; 'm' for multi-line
  // anchors (consistent with upstream's "every regex is implicitly multiline").
  const flags = caseInsensitive ? 'gmi' : 'gm';
  return new RegExp(pattern, flags);
}

function escapeForRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Compile a Keywords value into a flat KeywordDict mapping each lexeme to its
 * (scope, relevance) pair.
 */
function buildKeywordDict(k: Keywords): KeywordDict {
  const out = new Map<string, readonly [string, number]>();
  if (typeof k === 'string') {
    for (const w of splitKeywords(k)) out.set(w, ['keyword', 1]);
  } else if (Array.isArray(k)) {
    for (const w of k as readonly string[]) out.set(w, ['keyword', 1]);
  } else {
    const obj = k as Readonly<Record<string, string | readonly string[]>>;
    for (const scope of Object.keys(obj)) {
      if (scope === '$pattern') continue;
      const v = (obj as Record<string, unknown>)[scope];
      const list = typeof v === 'string' ? splitKeywords(v) : (v as readonly string[]);
      for (const w of list) out.set(w, [scope, defaultRelevanceForScope(scope)]);
    }
  }
  return out;
}

function splitKeywords(s: string): readonly string[] {
  return s
    .split(/\s+/)
    .map((w) => {
      // Upstream supports `keyword|N` to set a per-keyword relevance override.
      // We accept the syntax but for now drop the relevance modifier — v0
      // matcher uses defaultRelevanceForScope. (Tracked: open question in
      // build-manifest if any test in subsequent cohorts depends on this.)
      const idx = w.indexOf('|');
      return idx >= 0 ? w.slice(0, idx) : w;
    })
    .filter((w) => w.length > 0);
}

function defaultRelevanceForScope(scope: string): number {
  if (scope === 'keyword') return 1;
  if (scope === 'literal') return 0;
  return 0;
}
