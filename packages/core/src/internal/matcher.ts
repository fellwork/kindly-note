// Minimal matcher loop - v0. spec section 9.4 (compiled mode shape).
//
// This is intentionally a "first-match wins" walker over the root mode's
// `contains` list. It is sufficient for the keystone tests (a stub language
// with simple begin patterns; emits scope/text/scope close events). It does
// NOT implement nested mode descent, end-mode handling, illegal escalation,
// or relevance tracking beyond a counter. Subsequent cohorts will replace
// this with a multi-regex resumable matcher; the public emitter contract
// stays stable.
//
// Why so minimal? spec section 0 architectural shifts #1-#3 are about the
// PUBLIC SHAPE - types, immutability, plugin pipeline, emitter abstraction.
// The Director's gates (build-manifest dispatch sec D) require keystone
// tests for those shifts; they don't require a full reproduction of the
// upstream parser semantics. Cohort 1 ships the public surface and a
// matcher that exercises it end-to-end on simple grammars.

import type { CompiledLanguage, CompiledMode } from '../compile.js';
import type { Emitter } from '../emitter.js';

export interface MatcherResult {
  readonly relevance: number;
  readonly illegal: boolean;
}

/**
 * Walk `code` against the compiled root mode. For each character/run:
 *   1. Try the keyword dict. If it matches a lexeme, emit (scope, lexeme).
 *   2. Else try each child mode's beginRe (or matchRe). First match wins:
 *      open scope, emit text inside, close scope. (No descent in v0.)
 *   3. Else emit a literal char of text.
 *
 * The matcher is generic over emitter output: it never inspects the emitter's
 * private state.
 */
export function runMatcher(
  lang: CompiledLanguage,
  code: string,
  emitter: Emitter<unknown>,
): MatcherResult {
  // Fast-path escape hatch: spec section 7.3 row "__emitTokens".
  if (lang.emitTokens !== undefined) {
    lang.emitTokens(code, emitter);
    return { relevance: 0, illegal: false };
  }

  const root = lang.root;
  let i = 0;
  let relevance = 0;
  let textBuffer = '';

  const flushText = (): void => {
    if (textBuffer.length > 0) {
      emitter.addText(textBuffer);
      textBuffer = '';
    }
  };

  const tryKeywordAt = (idx: number): { len: number; scope: string; relevance: number } | null => {
    if (root.keywords === undefined) return null;
    // Match an identifier-shaped lexeme starting at idx. We use a small
    // ad-hoc scanner: word characters [A-Za-z0-9_$].
    let j = idx;
    while (j < code.length) {
      const ch = code.charCodeAt(j);
      const isWord =
        (ch >= 0x41 && ch <= 0x5a) || // A-Z
        (ch >= 0x61 && ch <= 0x7a) || // a-z
        (ch >= 0x30 && ch <= 0x39) || // 0-9
        ch === 0x5f || // _
        ch === 0x24; // $
      if (!isWord) break;
      j++;
    }
    if (j === idx) return null;
    const lexeme = code.slice(idx, j);
    const entry = root.keywords.get(lexeme);
    if (entry === undefined) return null;
    return { len: lexeme.length, scope: entry[0], relevance: entry[1] };
  };

  // The set of begin candidates. Each child mode contributes a regex.
  const beginCandidates: readonly { mode: CompiledMode; re: RegExp }[] = root.contains
    .map((m) => (m.beginRe !== undefined ? { mode: m, re: m.beginRe } : null))
    .filter((c): c is { mode: CompiledMode; re: RegExp } => c !== null);

  while (i < code.length) {
    // 1. Keyword match
    const kw = tryKeywordAt(i);
    if (kw !== null) {
      flushText();
      emitter.startScope(kw.scope);
      emitter.addText(code.slice(i, i + kw.len));
      emitter.endScope();
      relevance += kw.relevance;
      i += kw.len;
      continue;
    }

    // 2. Child-mode begin match (anchored to position i)
    let matched: { mode: CompiledMode; len: number } | null = null;
    for (const cand of beginCandidates) {
      cand.re.lastIndex = i;
      const found = cand.re.exec(code);
      if (found !== null && found.index === i) {
        matched = { mode: cand.mode, len: found[0].length };
        break;
      }
    }
    if (matched !== null) {
      flushText();
      const m = matched;
      const text = code.slice(i, i + m.len);
      // Emit begin/end scope from beginScope/scope/endScope as relevant.
      const scope = typeof m.mode.scope === 'string' ? m.mode.scope : undefined;
      if (scope !== undefined) emitter.startScope(scope);
      // For v0, no nested descent; the matched text is emitted as a plain
      // text run inside the scope. (matchRe-only modes behave the same way.)
      emitter.addText(text);
      if (scope !== undefined) emitter.endScope();
      relevance += m.mode.relevance;
      i += m.len;
      continue;
    }

    // 3. Literal char
    textBuffer += code.charAt(i);
    i++;
  }

  flushText();
  return { relevance, illegal: false };
}
