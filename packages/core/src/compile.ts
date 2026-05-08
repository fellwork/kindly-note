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
 * Cohort 3a deepens the matcher; pre-computed fields added here are read-only
 * artifacts used by `internal/matcher.ts` to drive the parser without
 * re-compiling regexes per highlight call. Spec §9.4.
 *
 * Field additions over cohort 1 (all readonly, additive):
 *   - `beginPattern`/`endPattern`: source-string forms of begin/end (kept so
 *     parent unions can compose them via union without parsing the RegExp).
 *   - `terminatorEnd`: this mode's effective end pattern as a source string,
 *     including `endsWithParent` propagation. Used to build the parent's
 *     terminator union. (Mirrors upstream `cmode.terminatorEnd`.)
 *   - `endSameAsBegin`: forwarded from the source so the matcher can
 *     synthesise a literal end regex from the matched begin lexeme at
 *     runtime.
 *   - `keywordPatternRe`: the lexeme tokenizer regex used to find keyword
 *     candidates in a buffer. Mirrors upstream `cmode.keywordPatternRe`.
 */
export interface CompiledMode {
  readonly scope?: string;
  readonly label?: string;
  readonly beginRe?: RegExp;
  readonly endRe?: RegExp;
  readonly matchRe?: RegExp;
  readonly illegalRe?: RegExp;
  readonly keywords?: KeywordDict;
  readonly keywordPatternRe?: RegExp;
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
  readonly endSameAsBegin: boolean;
  readonly beginScope?: string | ScopeMap;
  readonly endScope?: string | ScopeMap;
  /** Source-string form of the begin pattern (for capture in parent union). */
  readonly beginPattern?: string;
  /** Source-string form of the end pattern (for capture in parent union). */
  readonly endPattern?: string;
  /**
   * Effective end-source for this mode in the context of its parent —
   * includes `endsWithParent` propagation. Empty string when the mode has no
   * end and does not propagate. Mirrors upstream `terminatorEnd`. Spec §9.4.
   */
  readonly terminatorEnd: string;
  /** Whether `caseInsensitive` was applied during regex compilation. */
  readonly caseInsensitive: boolean;
  /**
   * True when the source mode's `begin` or `match` was an array — meaning the
   * compiled pattern is a concatenation of capture groups, one per array
   * element. The matcher uses this flag plus `beginScope` (a ScopeMap when
   * present) to emit a per-group scope on the begin lexeme. spec §8.2.1
   * worked example.
   */
  readonly isMultiCapture: boolean;
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
  parentCompiled: CompiledMode | undefined,
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

  // Multi-capture-group begin/match: when `match`/`begin` is an array, upstream
  // (mode_compiler.js#multiClassNeeded) concatenates the elements as separate
  // capture groups so a per-group scope map can attribute each lexeme. Mirrors
  // upstream `buildModeRegex` (`(part1)(part2)(part3)`). Spec §8.2.1 worked
  // example uses this in the JS class-declaration mode (`match: [/class/,
  // /\s+/, IDENT_RE]`). Cohort 4 (lang-javascript) is the first language to
  // exercise this path. The boolean `multiCapture` is recorded so the matcher
  // can route per-group scope emit at runtime.
  const multiCapture = Array.isArray(mutable.begin) || Array.isArray(mutable.match);
  const rawBeginPattern = pickBeginOrMatchPattern(mutable.begin ?? mutable.match);
  const rawEndPattern = pickPattern(mutable.end);
  const illegalPattern = pickPattern(mutable.illegal);
  const matchPattern = pickBeginOrMatchPattern(mutable.match);

  // Respect beginKeywords by treating them as an alternation of literals
  // — anchored match for the keyword set. spec compatibility note: upstream
  // does the same in mode_compiler beginKeywords expansion.
  let effectiveBeginPattern: string | undefined;
  if (mutable.beginKeywords !== undefined && mutable.beginKeywords !== '') {
    const words = mutable.beginKeywords.split(/\s+/).filter((w) => w.length > 0);
    const alt = words.map(escapeForRegex).join('|');
    effectiveBeginPattern = `(?:${alt})\\b`;
  } else if (rawBeginPattern !== undefined) {
    effectiveBeginPattern = rawBeginPattern;
  }
  const effectiveBeginRe =
    effectiveBeginPattern !== undefined
      ? compileRe(effectiveBeginPattern, caseInsensitive)
      : undefined;

  // We construct the compiled node as a mutable shape, then freeze. This is
  // necessary because the parent-aware `terminatorEnd` propagation needs the
  // pre-computed beginPattern/endPattern of *this* mode, but the children's
  // terminatorEnd computations need *this* mode's terminatorEnd as their
  // parent's. Compute self first, then children, then assemble.

  // Spec §9.4 alignment with upstream `mode_compiler.js`:
  //   - if no begin and we're nested inside a parent, default begin is /\B|\b/.
  //   - if no end AND not endsWithParent, default end is /\B|\b/.
  // For top-level (parent === undefined) we leave beginPattern undefined; the
  // root mode never has its own begin (its `contains` define begin candidates).
  let beginPatternForUse: string | undefined = effectiveBeginPattern;
  let endPatternForUse: string | undefined = rawEndPattern;
  if (parent !== undefined) {
    if (beginPatternForUse === undefined) beginPatternForUse = '\\B|\\b';
    if (endPatternForUse === undefined && mutable.endsWithParent !== true) {
      endPatternForUse = '\\B|\\b';
    }
  }

  // terminatorEnd: this mode's effective end source for use in its PARENT's
  // begin/end union. When `endsWithParent` is true, append the parent's
  // terminatorEnd via `|`. Mirrors upstream lib/mode_compiler.js:343-346.
  let terminatorEnd = endPatternForUse ?? '';
  if (
    mutable.endsWithParent === true &&
    parentCompiled !== undefined &&
    parentCompiled.terminatorEnd !== ''
  ) {
    terminatorEnd += (terminatorEnd !== '' ? '|' : '') + parentCompiled.terminatorEnd;
  }

  const keywords = mutable.keywords !== undefined ? buildKeywordDict(mutable.keywords) : undefined;
  const keywordPatternRe =
    keywords !== undefined ? compileKeywordPatternRe(mutable, caseInsensitive) : undefined;

  // Build a partial CompiledMode for the parentCompiled-of-children link.
  // We assemble children with this partial, then construct the final frozen
  // node. The partial must include `terminatorEnd` (the only field children
  // read) and other readonly fields (since the type is fully readonly we
  // produce a coerced shape).
  const partial: CompiledMode = Object.freeze({
    contains: Object.freeze([] as readonly CompiledMode[]),
    relevance: mutable.relevance ?? 1,
    excludeBegin: mutable.excludeBegin ?? false,
    excludeEnd: mutable.excludeEnd ?? false,
    returnBegin: mutable.returnBegin ?? false,
    returnEnd: mutable.returnEnd ?? false,
    skip: mutable.skip ?? false,
    endsParent: mutable.endsParent ?? false,
    endsWithParent: mutable.endsWithParent ?? false,
    endSameAsBegin: mutable.endSameAsBegin ?? false,
    terminatorEnd,
    caseInsensitive,
    isMultiCapture: multiCapture,
  });

  // Spec §9.4: `variants` expansion. Upstream's `expandOrCloneMode`
  // (`mode_compiler.js:404-432`) replaces a mode with `variants: [...]` by N
  // sibling modes — each variant is `{ ...parent, ...variant, variants: [] }`.
  // The expansion happens in the parent's children loop. spec §8.2.1: JS uses
  // `variants` for `CLASS_OR_EXTENDS` (with-extends vs without) and
  // `FUNCTION_DEFINITION` (named vs anonymous), so cohort 4 is the first
  // language to exercise this.
  const expandedChildren: Mode[] = [];
  for (const child of mutable.contains ?? []) {
    if (child === 'self') continue;
    if (child.variants !== undefined && child.variants.length > 0) {
      for (const variant of child.variants) {
        expandedChildren.push(mergeVariantWithParent(child, variant));
      }
    } else {
      expandedChildren.push(child);
    }
  }

  const compiledContains: readonly CompiledMode[] = Object.freeze(
    expandedChildren.map((c) => compileMode(c, mutable, partial, exts, caseInsensitive)),
  );

  // Spec §8.2.1: when `match` (or `begin`) is an array AND `scope` is a
  // ScopeMap, the per-capture-group scope is published via `beginScope` for
  // the matcher's runtime per-group emit. We normalise here so the matcher
  // only ever consults `beginScope`/`endScope` (typed as `string | ScopeMap`).
  // Upstream mode_compiler does the analogous "scope as ScopeMap → beginScope"
  // promotion in compileMode#multiClass.
  let derivedBeginScope: string | ScopeMap | undefined = mutable.beginScope;
  if (
    derivedBeginScope === undefined &&
    multiCapture &&
    typeof mutable.scope === 'object' &&
    mutable.scope !== null
  ) {
    derivedBeginScope = mutable.scope as ScopeMap;
  }

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
    endSameAsBegin: mutable.endSameAsBegin ?? false,
    terminatorEnd,
    caseInsensitive,
    isMultiCapture: multiCapture,
    ...(typeof mutable.scope === 'string' ? { scope: mutable.scope } : {}),
    ...(mutable.label !== undefined ? { label: mutable.label } : {}),
    ...(effectiveBeginRe !== undefined ? { beginRe: effectiveBeginRe } : {}),
    ...(beginPatternForUse !== undefined ? { beginPattern: beginPatternForUse } : {}),
    ...(endPatternForUse !== undefined
      ? { endRe: compileRe(endPatternForUse, caseInsensitive), endPattern: endPatternForUse }
      : {}),
    ...(matchPattern !== undefined && mutable.match !== undefined
      ? { matchRe: compileRe(matchPattern, caseInsensitive) }
      : {}),
    ...(illegalPattern !== undefined
      ? { illegalRe: compileRe(illegalPattern, caseInsensitive) }
      : {}),
    ...(keywords !== undefined ? { keywords } : {}),
    ...(keywordPatternRe !== undefined ? { keywordPatternRe } : {}),
    ...(mutable.subLanguage !== undefined ? { subLanguage: mutable.subLanguage } : {}),
    ...(derivedBeginScope !== undefined ? { beginScope: derivedBeginScope } : {}),
    ...(mutable.endScope !== undefined ? { endScope: mutable.endScope } : {}),
  };

  return Object.freeze(compiled);
}

/**
 * Compile the keyword-tokenizer regex for a mode. Mirrors upstream
 * `keywordPatternRe = langRe(keywordPattern, true)` from
 * lib/mode_compiler.js:336. The pattern comes from `keywords.$pattern` if
 * present (object form), else from the legacy `mode.lexemes` field, else
 * defaults to /\w+/. We compile with the global flag so the matcher can
 * walk a buffer with `lastIndex`.
 */
function compileKeywordPatternRe(mode: Mode, caseInsensitive: boolean): RegExp {
  let pattern: string | undefined;
  if (typeof mode.keywords === 'object' && !Array.isArray(mode.keywords)) {
    const obj = mode.keywords as { readonly $pattern?: RegexLike };
    if (obj.$pattern !== undefined) pattern = regexSource(obj.$pattern);
  }
  if (pattern === undefined && mode.lexemes !== undefined) {
    pattern = regexSource(mode.lexemes);
  }
  if (pattern === undefined || pattern === '') pattern = '\\w+';
  const flags = caseInsensitive ? 'gmi' : 'gm';
  return new RegExp(pattern, flags);
}

function pickPattern(p: RegexLike | readonly RegexLike[] | undefined): string | undefined {
  if (p === undefined) return undefined;
  if (Array.isArray(p)) {
    if (p.length === 0) return undefined;
    return p.map(regexSource).join('|');
  }
  return regexSource(p as RegexLike);
}

/**
 * Variant of `pickPattern` for `begin` and `match`: arrays are CONCATENATED as
 * separate capture groups (mirrors upstream `mode_compiler.js#buildModeRegex`),
 * not alternated. This is the canonical way upstream expresses
 * "match a sequence of N parts and assign each part its own scope" — see the
 * JS class-declaration mode in spec §8.2.1.
 *
 * Single-RegExp values pass through with their full source (capture groups
 * inside a single source RegExp are preserved).
 */
function pickBeginOrMatchPattern(
  p: RegexLike | readonly RegexLike[] | undefined,
): string | undefined {
  if (p === undefined) return undefined;
  if (Array.isArray(p)) {
    if (p.length === 0) return undefined;
    return p.map((part) => `(${regexSource(part)})`).join('');
  }
  return regexSource(p as RegexLike);
}

/**
 * Merge a `variants` entry onto its parent mode. Mirrors upstream
 * `expandOrCloneMode` (`mode_compiler.js:404-432`): each variant becomes a
 * sibling mode that inherits the parent's fields, then layers its own fields
 * on top. The parent's `variants` array is dropped from the result so the
 * synthetic mode is treated as terminal at compile time.
 */
function mergeVariantWithParent(parent: Mode, variant: Mode): Mode {
  // The variant's fields override the parent's. We strip `variants` from the
  // merged record so the recursive compileMode call doesn't loop on it. Use
  // destructuring rather than `delete` to keep biome's noDelete rule happy.
  const { variants: _stripped, ...rest } = { ...parent, ...variant } as Mode & {
    variants?: readonly Mode[];
  };
  void _stripped;
  return rest as Mode;
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
