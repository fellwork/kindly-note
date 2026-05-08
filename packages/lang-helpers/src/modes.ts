// Tree-shakable Mode helpers for kindly-note language packages.
//
// spec §1.2 row `@kindly-note/lang-helpers` — public surface:
//   comment(), cLineComment, cBlockComment, cNumberMode, apostropheString,
//   quoteString, phrasalWords, numberMode, binaryNumberMode, regexpMode,
//   titleMode, methodGuard, endSameAsBegin
//
// spec §0 architectural shifts #1 + #2:
//   1. Languages (and the modes they reference) are values, not side effects.
//   2. Helpers produce frozen Mode objects. The matcher in @kindly-note/core
//      cannot mutate them; cross-highlighter sharing is safe (cf. spec §9.2,
//      "shared-mode helpers ... would corrupt each other's state" — explicitly
//      avoided here by deep freezing).
//
// Naming convention: this package publishes camelCase identifiers. Upstream's
// `C_LINE_COMMENT_MODE` becomes `cLineComment`; `END_SAME_AS_BEGIN` becomes
// `endSameAsBegin`. The intent is preserved; the surface is modernized.
//
// IMPORTANT: this file imports `Mode` from @kindly-note/core *as a type only*
// (`import type`). spec §1.2: lang-helpers depends on core for types only —
// no runtime edge. After dts erasure, this file references nothing from core
// at runtime, so the package is fully tree-shakable on the dependency graph.

import type { Mode } from '@kindly-note/core';
import { deepFreeze } from './internal/deep-freeze.js';
import {
  BINARY_NUMBER_RE,
  C_NUMBER_RE,
  IDENT_RE,
  NUMBER_RE,
  UNDERSCORE_IDENT_RE,
} from './regex-constants.js';

// ---------------------------------------------------------------------------
// Backslash escape — shared sub-mode used by string modes.
// ---------------------------------------------------------------------------

/**
 * Escape sequence inside string-like modes: backslash followed by any one
 * character. Relevance 0 because escapes alone aren't a strong signal.
 *
 * Used as a `contains` entry in `apostropheString` and `quoteString`.
 */
export const backslashEscape: Mode = deepFreeze<Mode>({
  begin: '\\\\[\\s\\S]',
  relevance: 0,
});

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

// English-word alternation used inside `comment()` to detect prose. Mirrors
// upstream's logic — three English-looking words in a row strongly suggest
// the surrounding region truly is a comment, not a false-positive scan in the
// wrong language.
const ENGLISH_WORD_RE = [
  // Common 1- and 2-letter words; ordering follows upstream for parity.
  'I',
  'a',
  'is',
  'so',
  'us',
  'to',
  'at',
  'if',
  'in',
  'it',
  'on',
].join('|');

const ENGLISH_PROSE_BEGIN =
  // [space]+ + ( ENGLISH_WORD | contraction | hyphenated | capitalized ) + [.]?[:]?( . | space ) — three times
  // We keep this as a string and let the matcher compile it. The mode is a
  // begin-only rule with no end (it's a within-comment heuristic).
  // biome-ignore lint/style/useTemplate: keep the pieces visually grouped
  '[ ]+' +
  '(' +
  '(?:' +
  ENGLISH_WORD_RE +
  '|' +
  // contractions: can't, we'd, they're, let's, etc.
  "[A-Za-z]+[']" +
  '(?:d|ve|re|ll|t|s|n)' +
  '|' +
  // hyphenated lowercase: no-way, foo-bar
  '[A-Za-z]+[-][a-z]+' +
  '|' +
  // capitalized words at the start of a sentence
  '[A-Za-z][a-z]{2,}' +
  ')' +
  '[.]?[:]?(?:[.][ ]|[ ])' +
  '){3}';

/**
 * Build a comment mode. spec §1.2: `comment()` is the canonical comment-mode
 * factory. The returned Mode is fresh (every call) and deep-frozen.
 *
 * Intent (mirrors upstream):
 *   - scope: 'comment'
 *   - includes a `doctag` sub-mode for TODO/FIXME/NOTE/BUG/OPTIMIZE/HACK/XXX
 *   - includes a prose-detection sub-mode that boosts confidence the region
 *     truly is a comment vs. a wrong-language scan
 *
 * @param begin — opening delimiter (regex source or RegExp)
 * @param end   — closing delimiter (regex source or RegExp)
 * @param modeOptions — extra Mode fields merged on top of the defaults. Any
 *   `contains` provided here is appended after the doctag/prose contains.
 *   Provided fields override the defaults (`scope`, `begin`, `end`).
 */
export function comment(
  begin: string | RegExp,
  end: string | RegExp,
  modeOptions: Partial<Mode> = {},
): Mode {
  const baseContains: Mode[] = [
    {
      scope: 'doctag',
      // Lookahead-style begin: gobble the leading whitespace but not the
      // doctag word itself; the matching `end` then captures the keyword.
      // Mirrors upstream's doctag-without-the-space hack.
      begin: '[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)',
      end: /(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,
      excludeBegin: true,
      relevance: 0,
    },
    {
      // The prose-detection rule. begin-only; the engine matches it
      // *inside* the surrounding comment region, contributing relevance.
      begin: ENGLISH_PROSE_BEGIN,
    },
  ];

  // Merge: caller-supplied modeOptions can replace any default field. If the
  // caller supplies their own `contains`, we append after the base contains
  // so doctag/prose still apply. (Concat-and-keep-order; matches upstream
  // intent — caller's modes are checked after the built-ins.)
  const callerContains = modeOptions.contains;
  const merged: Mode = {
    scope: 'comment',
    begin,
    end,
    contains:
      callerContains !== undefined
        ? [...baseContains, ...(callerContains as readonly Mode[])]
        : baseContains,
    ...stripMergedKeys(modeOptions),
  };

  return deepFreeze<Mode>(merged);
}

/**
 * Strip the keys we already placed in the merged Mode literal so the spread
 * `...modeOptions` doesn't reintroduce a `contains` field that overwrites our
 * appended one. Returns a new object; safe even when modeOptions is frozen.
 */
function stripMergedKeys(opts: Partial<Mode>): Partial<Mode> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(opts) as Array<keyof Mode>) {
    if (k === 'contains') continue;
    if (k === 'scope' || k === 'begin' || k === 'end') {
      // Caller's overrides are honored; we put them through the spread later.
      out[k] = (opts as Record<string, unknown>)[k];
      continue;
    }
    out[k] = (opts as Record<string, unknown>)[k];
  }
  return out as Partial<Mode>;
}

/** `// line comment to end-of-line` (C / C++ / JS / TS / Rust / etc.). */
export const cLineComment: Mode = comment('//', '$');

/** `/* block comment * /` (C / C++ / JS / TS / Java / etc.). */
export const cBlockComment: Mode = comment('/\\*', '\\*/');

/** `# line comment to end-of-line` (Python / Ruby / shell / etc.). */
export const hashComment: Mode = comment('#', '$');

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/** `'…'` single-quoted string with backslash escapes; newline is illegal. */
export const apostropheString: Mode = deepFreeze<Mode>({
  scope: 'string',
  begin: "'",
  end: "'",
  illegal: '\\n',
  contains: [backslashEscape],
});

/** `"…"` double-quoted string with backslash escapes; newline is illegal. */
export const quoteString: Mode = deepFreeze<Mode>({
  scope: 'string',
  begin: '"',
  end: '"',
  illegal: '\\n',
  contains: [backslashEscape],
});

// ---------------------------------------------------------------------------
// Phrasal words — relevance-boosting prose helper
// ---------------------------------------------------------------------------

/**
 * A begin-only Mode whose match is a regex of common English filler words
 * (articles, contractions, modals). Used inside language packs to boost
 * relevance when the surrounding region looks like prose — e.g., to nudge
 * Markdown over Plaintext on a code chunk that is mostly English. spec §1.2.
 */
export const phrasalWords: Mode = deepFreeze<Mode>({
  begin:
    /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/,
});

// ---------------------------------------------------------------------------
// Number helpers
// ---------------------------------------------------------------------------

/** Plain decimal number — `123`, `12.3`. Relevance 0. */
export const numberMode: Mode = deepFreeze<Mode>({
  scope: 'number',
  begin: NUMBER_RE,
  relevance: 0,
});

/**
 * C-style number — hex (`0xFF`), decimal, exponent (`1e6`). Relevance 0.
 * spec §1.2 lists this as `cNumberMode`.
 */
export const cNumberMode: Mode = deepFreeze<Mode>({
  scope: 'number',
  begin: C_NUMBER_RE,
  relevance: 0,
});

/** Binary literal `0b1010`. Relevance 0. */
export const binaryNumberMode: Mode = deepFreeze<Mode>({
  scope: 'number',
  begin: BINARY_NUMBER_RE,
  relevance: 0,
});

// ---------------------------------------------------------------------------
// Regex literal mode (JS-style)
// ---------------------------------------------------------------------------

/**
 * JavaScript-style regex literal: `/pattern/flags`. spec §1.2.
 *
 * Includes a nested `[...]` character-class sub-mode so that `/`-inside-class
 * does not prematurely terminate the regex literal.
 */
export const regexpMode: Mode = deepFreeze<Mode>({
  scope: 'regexp',
  begin: /\/(?=[^/\n]*\/)/,
  end: /\/[gimuy]*/,
  contains: [
    backslashEscape,
    {
      begin: /\[/,
      end: /\]/,
      relevance: 0,
      contains: [backslashEscape],
    },
  ],
});

// ---------------------------------------------------------------------------
// Title mode (function/class names)
// ---------------------------------------------------------------------------

/** Identifier-shaped title: matches `[a-zA-Z]\w*`. Relevance 0. */
export const titleMode: Mode = deepFreeze<Mode>({
  scope: 'title',
  begin: IDENT_RE,
  relevance: 0,
});

/** Title that allows a leading underscore: `[a-zA-Z_]\w*`. Relevance 0. */
export const underscoreTitleMode: Mode = deepFreeze<Mode>({
  scope: 'title',
  begin: UNDERSCORE_IDENT_RE,
  relevance: 0,
});

// ---------------------------------------------------------------------------
// Method guard
// ---------------------------------------------------------------------------

/**
 * Excludes method names from keyword processing. After a `.` (with optional
 * whitespace), an identifier should not be highlighted as a keyword — e.g.,
 * in `arr.length`, `length` is a property access, not the keyword `length`.
 * Relevance 0. spec §1.2.
 */
export const methodGuard: Mode = deepFreeze<Mode>({
  begin: `\\.\\s*${UNDERSCORE_IDENT_RE}`,
  relevance: 0,
});

// ---------------------------------------------------------------------------
// endSameAsBegin
// ---------------------------------------------------------------------------

/**
 * Wrap a Mode so its `end` only matches when capture-group 1 of the begin
 * matches capture-group 1 of the end. Used for heredoc / ruby-style %w(...)
 * delimiters where the closing delimiter must equal the opening one. spec §1.2.
 *
 * The wrapped Mode SHALL declare a `begin` regex with at least one capture
 * group; group 1 is the value compared.
 *
 * Returns a *new* frozen Mode with the same fields as the input plus an
 * `endSameAsBegin: true` marker. The matcher in @kindly-note/core wires the
 * begin/end equality check at compile time. We do NOT install a runtime
 * `on:begin` / `on:end` callback here — kindly-note's matcher handles the
 * compare via the typed `endSameAsBegin` Mode field (see Mode in core).
 */
export function endSameAsBegin(mode: Mode): Mode {
  return deepFreeze<Mode>({
    ...mode,
    endSameAsBegin: true,
  });
}

// ---------------------------------------------------------------------------
// Shebang
// ---------------------------------------------------------------------------

/**
 * Shebang line (`#!/usr/bin/env node`) at the very start of the file.
 * spec §8.2.1 worked example imports `shebang` from this package; upstream
 * exports it from `lib/modes.js`. Included here to honor §1.2's "etc." and
 * the spec's worked examples.
 *
 * Options:
 *   - binary: optional binary name (string or RegExp). When supplied, the
 *     begin regex is anchored to that binary (e.g., `binary: 'node'` →
 *     matches `#!/...node...`). Without binary, matches any shebang.
 *
 * The returned Mode does NOT include the upstream `on:begin` callback that
 * rejects matches at non-zero index. spec §0 shift #2 forbids per-Mode
 * runtime mutation hooks; the matcher in core uses the Mode's `begin` regex
 * (`^#![ ]*\\/`) to enforce the start-of-file constraint. (Open question in
 * the build manifest — flagged for review.)
 */
export interface ShebangOptions extends Partial<Mode> {
  readonly binary?: string | RegExp;
}

export function shebang(opts: ShebangOptions = {}): Mode {
  const beginShebang = '^#![ ]*\\/';
  // When `binary` is specified, build a more specific begin pattern that
  // anchors to the binary name: `^#!\s*/.*\bbinary\b.*`
  let begin: string | RegExp;
  if (opts.binary !== undefined) {
    const binarySource = typeof opts.binary === 'string' ? opts.binary : opts.binary.source;
    begin = `${beginShebang}.*\\b${binarySource}\\b.*`;
  } else {
    begin = beginShebang;
  }

  // Strip our explicit fields from opts before spreading so we don't have
  // duplicate keys.
  const { binary: _binary, ...rest } = opts as ShebangOptions;
  void _binary; // intentionally unused — the field is consumed above.

  const merged: Mode = {
    scope: 'meta',
    begin,
    end: /$/,
    relevance: 0,
    ...rest,
  };

  return deepFreeze<Mode>(merged);
}
