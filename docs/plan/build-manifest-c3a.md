# Build manifest - Cohort 3a: matcher deepening in `@kindly-note/core`

**Date:** 2026-05-08
**Builder:** Cohort 3a (kindly-note modernize track)
**Branch:** `feat/matcher-deepening`
**Spec contract:** `docs/plan/architect-spec.md` sections 0, 1.2, 5, 9, 12

This manifest documents what cohort 3a produced, with verification evidence
for each dispatch acceptance gate (sec C 1-10) and verification command (sec D).

---

## Scope summary

Cohort 1 shipped a "first-match wins" matcher placeholder
(`packages/core/src/internal/matcher.ts`, 133 lines). Cohort 1 open
question #6 explicitly deferred the deeper parser semantics to a later
cohort. Cohort 3a deepens the matcher to handle:

1. Nested mode descent (push/pop a mode stack).
2. End-mode handling (`end`, `endsWithParent`, `endSameAsBegin`).
3. Illegal-rule escalation (throw `IllegalSyntaxError`; convert to
   `result.illegal: true` per spec section 2.2).
4. Keyword detection (per-mode `keywordPatternRe`).
5. Sub-language recursion (engine callback wired via `runSubLanguage`).
6. Multi-regex union for begin candidates + end + illegal (one
   `(a)|(b)|(c)|...` regex per mode, branch tracked).

Public API unchanged - only internals deepen.

---

## Files modified

### `packages/core/src/internal/matcher.ts` - full rewrite
- Before: 133 lines, "first-match wins" walker over root.contains.
- After: ~360 lines, mode-stack-based parser with multi-regex union per
  frame, illegal-throw, keyword tokenizer, and sub-language callback.

### `packages/core/src/internal/multi-regex.ts` - new module (~140 lines)
- `MultiRegex<TMeta>` class. Builds `(a)|(b)|(c)|...` from N rules
  using one capture-group per rule for branch tracking. Mirrors
  upstream `MultiRegex` from `lib/mode_compiler.js:56-101`
  (algorithmic, not byte-for-byte).

### `packages/core/src/compile.ts` - additive changes
- Before: 233 lines.
- After: 287 lines. Added pre-computed `CompiledMode` fields:
  `terminatorEnd: string` (mirrors upstream `cmode.terminatorEnd` -
  includes `endsWithParent` propagation), `endSameAsBegin: boolean`
  (forwarded from source), `caseInsensitive: boolean`,
  `beginPattern?: string`, `endPattern?: string`,
  `keywordPatternRe?: RegExp`. All fields are `readonly`. The
  CompiledLanguage and CompiledMode shape stays backward-compatible:
  every prior field is preserved at the same name; the new fields
  are additive. `compileMode()` now takes a `parentCompiled` arg so
  children can read the parent's `terminatorEnd` for `endsWithParent`
  propagation. `compileLanguage()` calls it with `undefined` for the
  root.

### `packages/core/src/highlighter.ts` - small changes
- Wraps `runMatcher` in `driveMatcher()`, which:
  1. Constructs the `MatcherOptions` (forwarding `ignoreIllegals` and
     a `runSubLanguage` callback that recursively invokes the engine
     with a fresh emitter and finalises it).
  2. Catches `IllegalSyntaxError` and converts to
     `result.illegal: true` - UNLESS `errorMode === 'throw'` AND
     `ignoreIllegals === false`, in which case the error propagates.
- No public-API change.

### `packages/core/tests/matcher.test.ts` - new file (~340 lines, 14 tests)
- Acceptance gates #2-#10 from cohort 3a Builder dispatch sec C.

---

## Algorithmic notes

### Mode stack
The matcher maintains a `Frame[]` stack. `Frame` holds the live
`CompiledMode`, an optional `dynamicEndPattern` (used for
`endSameAsBegin` - the literal begin lexeme is escaped and used as
the end source), and a memoised per-frame `MultiRegex<RuleMeta>`.
The bottom of the stack is always the language's implicit root
mode; we never pop below it. Entering a child pushes; matching the
end pops.

### Multi-regex union construction
For each frame, we build a `MultiRegex` containing:
1. One rule per child of `frame.mode.contains` whose `beginPattern`
   is non-empty, type `'begin'`, meta `{kind:'begin', child}`.
2. One rule for the frame's effective end pattern (uses
   `dynamicEndPattern` if set, else `mode.terminatorEnd`), type
   `'end'`. Skipped when both are empty (or when this is the root
   mode with no end pattern).
3. One rule for the mode's `illegalRe`, type `'illegal'`.

The union pattern is `(p1)|(p2)|...|(pn)` - one capture group per
rule, used as a branch-tracking sentinel. After a match,
`MultiRegex.match()` finds the first non-undefined capture group,
maps it back to the rule, and returns the lexeme + capture groups
+ rule metadata.

**Backreference caveat:** Intra-rule backrefs (e.g. `(\w+)\1`) work
because the wrapper capture group is added at position 1 immediately
before the rule's own group 0. There is no other rule between the
wrapper and any reference target. Inter-rule backrefs (one rule
referencing another's capture group via numeric index) are not
supported in v0; upstream's `_rewriteBackreferences` would be
required. Flagged as **Open question #2**.

### Keyword scope resolution
Per-mode `keywordPatternRe` is compiled at compile time (default
`/\w+/g`, overridden by `keywords.$pattern` if the keywords are an
object form, else by the legacy `mode.lexemes` field). The
`processKeywords` walker mirrors upstream `processKeywords` from
`highlight.js:200-238`:
- `re.lastIndex = 0`, walk matches with the regex.
- For each lexeme, look up in the mode's `KeywordDict`.
- If found and the scope starts with `_`, accumulate as buffer text
  but still bump relevance (relevance-only, no scope emit).
- If found and scope is normal, flush buffer, emit
  `startScope(scope) / addText(lexeme) / endScope()`.
- If not found, accumulate as buffer text.
- After the loop, flush any trailing buffer.

The default scope for a flat string-list keyword set is `'keyword'`
(see `compile.ts buildKeywordDict()`). Acceptance #5 verifies this.

### Illegal handling
The matcher throws `IllegalSyntaxError(language, index, context)`
(from `errors.ts`). `HighlighterImpl.driveMatcher` catches it and
either:
- Converts to `{ relevance: 0, illegal: true }` (default; preserves
  partial emitter output), OR
- Re-throws unchanged when `errorMode === 'throw'` AND
  `ignoreIllegals === false`.

This matches the upstream behavior described in Scout sec 3 (the
upstream wrapper catches its own internal `Error` and returns
`{illegal: true}` to the caller).

### Sub-language recursion
The matcher receives a `runSubLanguage(code, language)` callback in
`MatcherOptions`. When a mode has `subLanguage: 'foo'` and the
buffer flush fires `processSubLanguage`, the callback resolves
`'foo'` against the highlighter's registry, runs a fresh inner
emitter through `driveMatcher`, finalises it, and returns the
frozen `TokenStream` + canonical name + relevance. The matcher then
calls `emitter.addSubLanguage(stream, language)` on the parent
emitter - never sharing emitter objects across the boundary. Spec
section 5.7.

When `subLanguage` is an array (auto-detect candidates), we currently
fall through to `addText` - auto-detect is out of scope for cohort
3a. Flagged as **Open question #1** (cohort 4 / @kindly-note/auto-detect).

---

## Test count + per-file split

Workspace totals after cohort 3a:

| Package                         | Before  | After   | Delta |
|---------------------------------|---------|---------|-------|
| `@kindly-note/core`             | 42      | **56**  | +14   |
| `@kindly-note/lang-helpers`     | 64      | 64      | 0     |
| `@kindly-note/emitters-html`    | 31      | 31      | 0     |
| **Workspace total**             | **137** | **151** | +14   |

Per-file split (core package):

| File                              | Tests |
|-----------------------------------|-------|
| `tests/regex.test.ts`             | 13    |
| `tests/emitter.test.ts`           | 2     |
| `tests/language.test.ts`          | 10    |
| `tests/plugin.test.ts`            | 6     |
| `tests/highlighter.test.ts`       | 11    |
| `tests/matcher.test.ts` *(new)*   | 14    |
| **Total**                         | 56    |

The 14 new tests cover acceptance gates #2 (1 test), #3 (2), #4 (3),
#5 (3), #6 (1), #7 (2), #8 (1), and #10 (1). Gate #1 (existing 42
tests still pass) is verified by re-run; gate #9 (no node-builtins
in `packages/core/src`) is verified by grep.

---

## Verification log

All commands run from repo root after the final commit:

| Command                                              | Result                |
|------------------------------------------------------|-----------------------|
| `bun install`                                        | up-to-date            |
| `bun run typecheck`                                  | exit 0 (tsc -b)       |
| `bun run --filter '@kindly-note/core' build`         | exit 0; index.js 31.11 KB |
| `bun run --filter '@kindly-note/core' test`          | 56/56 pass (6 files)  |
| `bun run --filter '@kindly-note/lang-helpers' test`  | 64/64 pass            |
| `bun run --filter '@kindly-note/emitters-html' test` | 31/31 pass            |
| `bun run lint`                                       | clean (51 files)      |
| grep node-builtins in `packages/core/src/`           | no matches            |

---

## Open questions / spec ambiguities

These are surfaced explicitly per Iron Law - none silently resolved.

### #1 - Sub-language with `subLanguage: string[]` (auto-detect candidates)
**Spec ambiguity:** Spec section 7.3 lists `Mode.subLanguage?: string | string[]`.
The string case is straightforward: resolve by name. The array case is
auto-detect-with-allowlist territory.

**Cohort 3a decision:** When `subLanguage` is an array, we fall
through to `addText` (the buffered text is emitted unscoped). This
is sound but does not yet exercise auto-detect.

**Followup:** Auto-detect lives in `@kindly-note/auto-detect` per
spec section 1.1. Wiring the array-form sub-language requires the
engine to know about the auto-detector; a clean approach is to pass
an optional `autoDetector` resolver alongside `runSubLanguage` in
`MatcherOptions`. Out of scope for cohort 3a; flagged for cohort 4+.

### #2 - Inter-rule regex backreferences
**Spec position:** Spec section 12 says "exact regex-engine internals
are Builder-time decisions" - the algorithmic surface stays consistent
with upstream, but performance may improve.

**Implementation gap:** The `MultiRegex.compile()` wraps each rule
in `(rule_pattern)`. A pattern like `(\w+)\1` *inside a single
rule* still works because group 1 is unchanged in offset by the
single-rule wrapper. But two rules cannot reference each other's
capture groups (no spec-required use case in v0 lang packages).

**Upstream:** Has `_rewriteBackreferences` in `lib/regex.js` that
renumbers backrefs across the alternation. Not ported in cohort
3a - no language definition known to require it.

**Decision:** Defer until a language pack needs it. When that
happens, port `_rewriteBackreferences` from upstream. Track when
cohort 3b (lang-json + lang-pack-ecmascript) lands; if the pattern
is needed there, port up-front; else defer.

### #3 - `endSameAsBegin` semantics - full lexeme vs. capture group
**Spec position:** The `Mode.endSameAsBegin?: boolean` field is in
the public type (spec section 2.2 reference, our `language.ts:75`).
But **upstream removed this field in v11** (replaced by
`hljs.END_SAME_AS_BEGIN()` mode helper which uses capture group
`[1]` from the begin regex via `on:begin`/`on:end` callbacks).

**Cohort 3a decision:** Implemented per spec - when `endSameAsBegin:
true`, the matcher synthesises an end regex from
`escapeForRegex(beginLexeme)` (the entire matched begin text). This
matches upstream's v10 semantics, NOT the v11 `END_SAME_AS_BEGIN`
helper which references capture group `[1]`.

**Followup:** If a cohort 3b+ language pack uses
`hljs.END_SAME_AS_BEGIN({begin: /<<-?\s*(\w+)/, ...})` (e.g. bash
heredoc, c++ raw strings), the v11 semantics matter - the end
should use capture group `[1]`, not the full begin lexeme. The
cohort 3a implementation handles single-character delimiters (the
acceptance #7 test uses `/['"]/` which captures the full lexeme as
the delimiter); multi-character begins with capture groups would
need a port of upstream's `END_SAME_AS_BEGIN` helper (probably as a
compiler extension, since the acceptance test confirms current
behavior is correct for the boolean form).

### #4 - `beginScope` and `endScope` (multi-class capture-group unwinding)
**Cohort 3a status:** The fields are present on `CompiledMode` but
the matcher does NOT yet emit per-capture-group scopes. The
`startNewMode` only emits `child.scope` (the whole-mode scope), not
`child.beginScope` (the per-capture-group scope multi-emitter).

**Why deferred:** No acceptance gate in sec C requires `beginScope`/
`endScope`; the existing 42 tests do not either. Upstream's
`emitMultiClass` (from `highlight.js:291-307`) handles the
multi-class case; porting it requires the matcher to know the
capture-group structure of the begin regex (which we have, since
`MultiMatchResult.groups` carries it).

**Followup:** Cohort 3b (lang-pack-ecmascript) likely needs this
for the typed function/class/method modes. Will port at that time.

### #5 - Resumable scan-at-same-position
**Cohort 3a status:** Not implemented. Upstream's
`ResumableMultiRegex` (Scout sec 4) handles the case where an
`on:begin`/`on:end` callback says "ignore this match" and the
parser should resume at the same position with the *next* rule.

**Why deferred:** The kindly-note v0 plugin protocol (spec section
2) deliberately drops `on:begin`/`on:end` callbacks (those were
mode-scoped and caused legacy adapter complexity). Without those
callbacks, the matcher never has reason to "ignore" a match. The
performance optimization remains available - when a future plugin
or compiler extension reintroduces match-ignore, port the
resumable wrapper.

### #6 - `variants` / `cachedVariants` expansion
**Cohort 3a status:** Not handled. Upstream's `expandOrCloneMode`
(`mode_compiler.js:404-432`) expands a mode with `variants: [...]`
into N separate compiled modes (one per variant), and clones a
mode that depends on its parent.

**Why deferred:** The cohort 1 compileMode does not call an
expand-step; mode definitions in tests/v0 do not use `variants`.
Cohort 3b/4 will likely need it (TypeScript number variants are
a canonical case).

**Followup:** Add `expandOrCloneMode` to compile.ts when the first
language with variants ships.

### #7 - `starts` (post-end "next mode" link)
**Cohort 3a status:** Not handled. Upstream's `mode.starts` causes
the matcher to enter a new mode immediately after an end fires.

**Why deferred:** No language in cohort 3a tests uses `starts`. The
field is in `Mode` (language.ts:86) but not on `CompiledMode` and
not consulted by the matcher.

**Followup:** Add to `CompiledMode` + handle in `closeMode` when
needed by a future cohort.

### #8 - `keywordPatternRe` default and case sensitivity
**Cohort 3a decision:** The default lexeme tokenizer is `/\w+/`.
This is what upstream uses (see `mode_compiler.js:330`).
`caseInsensitive` is taken from the language; the regex flags
include `i` when `caseInsensitive: true`. Keyword lookups
lowercase the lexeme when `caseInsensitive: true`.

**Open:** Upstream uses `language.case_insensitive` (snake_case);
we use `caseInsensitive` (camelCase). The kindly-note `Mode` /
`LanguageDefinition` types use camelCase by spec section 0
architectural shift #5 ("typed Mode shape"). Confirmed canonical.

### #9 - `MAX_KEYWORD_HITS` relevance dampening
**Upstream behaviour:** Each keyword's relevance is only counted up
to `MAX_KEYWORD_HITS` (7) times; further hits do not add to the
score. See `highlight.js:13` and the `keywordHits` map in
`processKeywords`.

**Cohort 3a status:** NOT implemented. Each keyword hit adds its
relevance unconditionally.

**Implication:** Languages will appear slightly more "relevant"
than upstream when they hit a keyword many times. Auto-detect tie-
breaking is the consumer of relevance scores, and cohort 3a does
NOT exercise auto-detect. Defer fix until cohort 4 (`@kindly-note/
auto-detect`) lands and we have an auto-detect regression bar.

### #10 - Sub-language input must be non-empty
**Cohort 3a decision:** We fire `processSubLanguage` only when
`modeBuffer` is non-empty (matches upstream behavior at
`highlight.js:241`). If the buffer is empty, we skip the recursive
call. Acceptance test #10 verifies this with `[hello]` containing
`hello`.

---

## What changed from spec verbatim

### `CompiledMode` field additions

Spec section 9.4 lists a sketch CompiledMode shape with these
fields: `scope`, `beginRe`, `endRe`, `illegalRe`, `keywords`,
`contains`, `matcher`, "all the other fields the parser needs".
Cohort 1 added many more concrete fields (relevance flags, etc.);
cohort 3a adds seven additional fields all `readonly`:

- `terminatorEnd: string` - pre-computed effective end source
  including `endsWithParent` propagation. Mirrors upstream
  `cmode.terminatorEnd` (cited in spec section 9.4 sketch as "all
  the other fields the parser needs" - explicit name from upstream).
- `endSameAsBegin: boolean` - forwarded from source `Mode`.
- `caseInsensitive: boolean` - needed by the matcher to apply `i`
  flag to dynamically-constructed regexes (`endSameAsBegin`,
  `endRe` re-anchoring) and to lowercase keyword lookups.
- `beginPattern?: string` - source-string form of begin (used by
  the multi-regex union builder, which composes patterns by string
  rather than by RegExp).
- `endPattern?: string` - source-string form of end.
- `keywordPatternRe?: RegExp` - pre-compiled lexeme tokenizer.
- (Cohort 1 fields preserved unchanged.)

These are additive; downstream code that destructures
`CompiledMode` for the cohort-1 fields still works.

### `MatcherOptions` is a new internal type

The matcher signature changed from:

```
runMatcher(lang, code, emitter)
```

to:

```
runMatcher(lang, code, emitter, opts: MatcherOptions)
```

`MatcherOptions` is an internal type (not exported from
`@kindly-note/core/index.ts`). Only `HighlighterImpl` calls
`runMatcher`; the public API surface is unchanged.

### `IllegalSyntaxError` propagation policy

Spec section 2.2 says `HighlightResult.illegal: boolean`. Spec
section 2.4 says `errorMode: 'safe' | 'throw'` controls plugin
error escalation. Cohort 3a applies the analogous rule to illegal-
syntax errors:

- Default (`errorMode: 'safe'`): `result.illegal = true`, no
  exception.
- `errorMode: 'throw'` AND `ignoreIllegals: false`: throw
  `IllegalSyntaxError` to the caller.
- `ignoreIllegals: true`: illegal matches treated as text.

This is a conservative reading: spec section 2.4 is silent on
illegal-syntax behaviour vs plugin errors. The chosen policy is
documented inline in `highlighter.ts driveMatcher()`.

---

## Summary

| Acceptance gate (dispatch sec C)    | Status        | Evidence                                |
|-------------------------------------|---------------|-----------------------------------------|
| #1 All 42 existing tests pass       | PASS          | `tests/{regex,emitter,language,plugin,highlighter}.test.ts` 42/42 |
| #2 Nested mode descent              | PASS          | `tests/matcher.test.ts:descent`         |
| #3 End-mode handling                | PASS          | `tests/matcher.test.ts:end-mode` (2)    |
| #4 Illegal-rule escalation          | PASS          | `tests/matcher.test.ts:illegal` (3)     |
| #5 Keyword detection                | PASS          | `tests/matcher.test.ts:keyword` (3)     |
| #6 endsWithParent                   | PASS          | `tests/matcher.test.ts:endsWithParent`  |
| #7 endSameAsBegin                   | PASS          | `tests/matcher.test.ts:endSameAsBegin` (2) |
| #8 No source-mode mutation          | PASS          | `tests/matcher.test.ts:source-frozen`   |
| #9 No node-builtins in core/src     | PASS          | grep ^import.*node: yields no matches   |
| #10 Sub-language stub               | PASS          | `tests/matcher.test.ts:sub-language`    |

Status: DONE.
