// Deepened matcher loop - cohort 3a. Spec section 9.4 (compiled mode shape),
// section 5.6 (engine emitter call-trace), section 12 (regex-engine internals
// are Builder-time decisions; algorithmic surface matches upstream).
//
// Capabilities (cohort 3a):
//   1. Nested mode descent - when a child's `begin` matches, the matcher
//      pushes onto the mode stack; subsequent matches happen relative to
//      the child's `contains`.
//   2. End-mode handling - `end` exits the current mode; `endsWithParent`
//      propagates the parent's end into the child's terminator union (via
//      `CompiledMode.terminatorEnd`); `endSameAsBegin` constructs an end
//      regex from the literal begin lexeme at runtime.
//   3. Illegal-rule escalation - `illegal` triggers `IllegalSyntaxError`
//      (caught upstream and converted to `result.illegal: true`).
//   4. Keyword detection - when a mode has `keywords`, the keyword tokenizer
//      walks the buffer (using `cmode.keywordPatternRe`) and emits scoped
//      spans for each matched lexeme. Mirrors upstream `processKeywords`.
//   5. Sub-language descent - when a mode has `subLanguage`, the matcher
//      calls back to the engine via the `runSubLanguage` callback. Spec
//      section 5.7.
//   6. Multi-regex union - per-mode terminator regex (begin candidates +
//      end + illegal) combined into one `(a)|(b)|(c)|...` pattern with
//      branch tracking. Spec section 12 (matches upstream `MultiRegex`).
//
// What is NOT yet here (flagged in build-manifest-c3a.md):
//   - Resumable scan-at-same-position (upstream's `ResumableMultiRegex`).
//   - `variants`/`cachedVariants` expansion at compile time.
//   - `starts` (the post-end "next mode" link).
//
// Internal-only - never exported from `@kindly-note/core` (spec section 1.2).

import type { CompiledLanguage, CompiledMode } from '../compile.js';
import type { Emitter, TokenStream } from '../emitter.js';
import { IllegalSyntaxError } from '../errors.js';
import { escape as regexEscape } from '../regex.js';
import { MultiRegex, type MultiMatchResult } from './multi-regex.js';

export interface MatcherResult {
  readonly relevance: number;
  readonly illegal: boolean;
}

export interface MatcherOptions {
  /** When true, illegal matches are treated as ordinary text. Spec section 2.2. */
  readonly ignoreIllegals: boolean;
  /**
   * Resolver for sub-language recursion. Returns the resulting TokenStream +
   * canonical name + relevance, or undefined when no language could be
   * resolved.
   */
  readonly runSubLanguage?: (
    code: string,
    language: string,
  ) => { stream: TokenStream; language: string; relevance: number } | undefined;
}

/** What kind of rule meta we attach to multi-regex rules. */
type RuleMeta =
  | { kind: 'begin'; child: CompiledMode }
  | { kind: 'end' }
  | { kind: 'illegal' };

/**
 * Per-stack-frame state. The frame holds the live mode plus the dynamic end
 * regex (used for `endSameAsBegin`) and a memoised multi-regex matcher.
 */
interface Frame {
  readonly mode: CompiledMode;
  /** Override for the mode's normal end pattern. Used by endSameAsBegin. */
  dynamicEndPattern?: string;
  /** Lazily compiled per-frame multi-regex. */
  matcher?: MultiRegex<RuleMeta>;
}

export function runMatcher(
  lang: CompiledLanguage,
  code: string,
  emitter: Emitter<unknown>,
  opts: MatcherOptions,
): MatcherResult {
  // Spec section 7.3 row "__emitTokens": fast-path escape hatch.
  if (lang.emitTokens !== undefined) {
    lang.emitTokens(code, emitter);
    return { relevance: 0, illegal: false };
  }

  let relevance = 0;
  let modeBuffer = '';
  // Mode stack - bottom is the implicit root, top is current mode.
  const stack: Frame[] = [{ mode: lang.root }];

  const peek = (): Frame => {
    const f = stack[stack.length - 1];
    if (f === undefined) {
      throw new Error('matcher invariant: mode stack drained');
    }
    return f;
  };

  /** Build (or fetch the cached) multi-regex for the given frame. */
  const matcherFor = (frame: Frame): MultiRegex<RuleMeta> => {
    if (frame.matcher !== undefined) return frame.matcher;
    const mr = new MultiRegex<RuleMeta>(frame.mode.caseInsensitive);
    // 1. Each child's begin pattern.
    for (const child of frame.mode.contains) {
      if (child.beginPattern !== undefined && child.beginPattern !== '') {
        mr.addRule({
          type: 'begin',
          meta: { kind: 'begin', child },
          pattern: child.beginPattern,
        });
      }
    }
    // 2. End pattern (if any). When the dynamicEndPattern override is set
    //    (endSameAsBegin), use it; otherwise compose terminatorEnd.
    const endPattern = frame.dynamicEndPattern ?? frame.mode.terminatorEnd;
    if (endPattern !== undefined && endPattern !== '') {
      mr.addRule({ type: 'end', meta: { kind: 'end' }, pattern: endPattern });
    }
    // 3. Illegal pattern.
    if (frame.mode.illegalRe !== undefined) {
      mr.addRule({
        type: 'illegal',
        meta: { kind: 'illegal' },
        pattern: frame.mode.illegalRe.source,
      });
    }
    mr.compile();
    frame.matcher = mr;
    return mr;
  };

  /** Process the buffered text - emit either keywords or sub-language. */
  const processBuffer = (): void => {
    const frame = peek();
    const mode = frame.mode;
    if (modeBuffer === '') return;

    if (mode.subLanguage !== undefined) {
      processSubLanguage(mode, modeBuffer);
    } else if (mode.keywords !== undefined) {
      processKeywords(mode);
    } else {
      emitter.addText(modeBuffer);
    }
    modeBuffer = '';
  };

  /**
   * Walk the buffered text against the mode's keyword tokenizer and emit
   * scoped spans for matched lexemes. Mirrors upstream `processKeywords`.
   */
  const processKeywords = (mode: CompiledMode): void => {
    const keywords = mode.keywords;
    const re = mode.keywordPatternRe;
    if (keywords === undefined || re === undefined) {
      emitter.addText(modeBuffer);
      return;
    }
    re.lastIndex = 0;
    let lastIndex = 0;
    let buf = '';
    let m: RegExpExecArray | null = re.exec(modeBuffer);
    while (m !== null) {
      buf += modeBuffer.substring(lastIndex, m.index);
      const word = mode.caseInsensitive ? m[0].toLowerCase() : m[0];
      const data = keywords.get(word);
      if (data !== undefined) {
        const [scope, kwRelevance] = data;
        if (buf !== '') {
          emitter.addText(buf);
          buf = '';
        }
        relevance += kwRelevance;
        if (scope.startsWith('_')) {
          // Underscored scope = relevance-only, no emit.
          buf += m[0];
        } else {
          emitter.startScope(scope);
          emitter.addText(m[0]);
          emitter.endScope();
        }
      } else {
        buf += m[0];
      }
      lastIndex = re.lastIndex;
      m = re.exec(modeBuffer);
    }
    buf += modeBuffer.substring(lastIndex);
    if (buf !== '') emitter.addText(buf);
  };

  /** Sub-language insertion - spec section 5.7. */
  const processSubLanguage = (mode: CompiledMode, buf: string): void => {
    const sub = mode.subLanguage;
    if (sub === undefined) return;
    if (typeof sub !== 'string') {
      // Auto-detect path - out of scope for cohort 3a.
      emitter.addText(buf);
      return;
    }
    if (opts.runSubLanguage === undefined) {
      emitter.addText(buf);
      return;
    }
    const result = opts.runSubLanguage(buf, sub);
    if (result === undefined) {
      emitter.addText(buf);
      return;
    }
    if (mode.relevance > 0) relevance += result.relevance;
    emitter.addSubLanguage(result.stream, result.language);
  };

  /** Open a new mode (push onto stack). Mirrors upstream `startNewMode`. */
  const startNewMode = (child: CompiledMode, lexeme: string): Frame => {
    if (typeof child.scope === 'string') {
      emitter.startScope(child.scope);
    }
    const frame: Frame = { mode: child };
    if (child.endSameAsBegin) {
      // Spec compatibility note: `endSameAsBegin` constructs the end regex
      // from the literal begin lexeme. Mirrors upstream's v10 semantics.
      // The v11 `END_SAME_AS_BEGIN` helper uses capture group [1]; our
      // typed v0 keeps the boolean flag on the Mode shape per spec
      // section 0. When set, the entire begin lexeme is taken as the end
      // pattern.
      frame.dynamicEndPattern = regexEscape(lexeme);
    }
    stack.push(frame);
    return frame;
  };

  /** Close a mode (pop the stack). Emits endScope if the mode had one. */
  const closeMode = (): void => {
    const f = stack.pop();
    if (f === undefined) return;
    if (typeof f.mode.scope === 'string') emitter.endScope();
    if (!f.mode.skip && f.mode.subLanguage === undefined) {
      relevance += f.mode.relevance;
    }
  };

  /**
   * Walk the stack to find the deepest mode that declares an `end` matching
   * here, taking `endsWithParent` into account. Returns how many frames to
   * pop, or null when no mode ends here. Mirrors upstream `endOfMode`.
   */
  const findEndMode = (matchPlusRemainder: string): { count: number } | null => {
    for (let i = stack.length - 1; i >= 1; i--) {
      const frame = stack[i];
      if (frame === undefined) break;
      const mode = frame.mode;
      let endsHere = false;
      if (frame.dynamicEndPattern !== undefined) {
        const re = new RegExp(
          `^(?:${frame.dynamicEndPattern})`,
          mode.caseInsensitive ? 'mi' : 'm',
        );
        endsHere = re.test(matchPlusRemainder);
      } else if (mode.endRe !== undefined) {
        const re = new RegExp(`^(?:${mode.endRe.source})`, mode.caseInsensitive ? 'mi' : 'm');
        endsHere = re.test(matchPlusRemainder);
      }
      if (endsHere) {
        let popCount = stack.length - i;
        let j = i;
        while (j > 1) {
          const f = stack[j];
          if (f === undefined || !f.mode.endsParent) break;
          popCount++;
          j--;
        }
        return { count: popCount };
      }
      if (!mode.endsWithParent) {
        return null;
      }
    }
    return null;
  };

  let i = 0;
  let iterations = 0;
  while (true) {
    iterations++;
    if (iterations > 100000 && iterations > i * 3) {
      throw new Error(
        `kindly-note matcher: potential infinite loop in language "${lang.name}" at index ${i}`,
      );
    }
    const top = peek();
    const mr = matcherFor(top);
    const m: MultiMatchResult<RuleMeta> | null = mr.match(code, i);
    if (m === null) {
      modeBuffer += code.slice(i);
      break;
    }
    if (m.index > i) {
      modeBuffer += code.slice(i, m.index);
    }

    if (m.type === 'begin') {
      const child = (m.meta as { kind: 'begin'; child: CompiledMode }).child;
      if (child.skip) {
        modeBuffer += m.lexeme;
        i = m.index + m.lexeme.length;
        continue;
      }
      if (child.excludeBegin) {
        modeBuffer += m.lexeme;
      }
      processBuffer();
      if (!child.returnBegin && !child.excludeBegin) {
        modeBuffer = m.lexeme;
      }
      startNewMode(child, m.lexeme);
      i = child.returnBegin ? m.index : m.index + m.lexeme.length;
    } else if (m.type === 'illegal') {
      if (opts.ignoreIllegals) {
        modeBuffer += m.lexeme;
        i = m.index + m.lexeme.length;
        continue;
      }
      throw new IllegalSyntaxError(
        lang.name,
        m.index,
        code.slice(Math.max(0, m.index - 32), m.index + 32),
      );
    } else {
      // type === 'end'
      const endInfo = findEndMode(code.slice(m.index));
      if (endInfo === null) {
        modeBuffer += m.lexeme;
        i = m.index + m.lexeme.length;
        continue;
      }
      const topFrame = peek();
      if (topFrame.mode.skip) {
        modeBuffer += m.lexeme;
      } else {
        if (!topFrame.mode.returnEnd && !topFrame.mode.excludeEnd) {
          modeBuffer += m.lexeme;
        }
        processBuffer();
        if (topFrame.mode.excludeEnd) {
          modeBuffer = m.lexeme;
        }
      }
      for (let k = 0; k < endInfo.count; k++) {
        closeMode();
      }
      i = topFrame.mode.returnEnd ? m.index : m.index + m.lexeme.length;
    }
  }

  processBuffer();
  while (stack.length > 1) {
    closeMode();
  }

  return { relevance, illegal: false };
}
