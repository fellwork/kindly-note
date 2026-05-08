// Multi-regex union builder — spec §12 ("exact regex-engine internals are
// Builder-time decisions"). Mirrors upstream `MultiRegex` from
// `lib/mode_compiler.js` (Scout §4) algorithmically, not byte-for-byte.
//
// Why? Per upstream: combining N candidate patterns into a single
// `(a)|(b)|(c)|...` regex and using capture-group position to determine
// which sub-pattern fired is the core performance mechanism — one regex
// run per step instead of N separate runs.
//
// Internal-only — never exported from `@kindly-note/core` (spec §1.2 row).

import { countMatchGroups } from '../regex.js';

/** What kind of rule fired in the unified match. */
export type MultiMatchType = 'begin' | 'end' | 'illegal';

/** Optional payload attached to a registered rule; surfaced on a successful match. */
export interface MultiRule<TMeta> {
  readonly type: MultiMatchType;
  readonly meta: TMeta;
  /** Source pattern as a string (for the union construction). */
  readonly pattern: string;
}

/** Result of a successful match. */
export interface MultiMatchResult<TMeta> {
  /** Where the match started in the input. */
  readonly index: number;
  /** Full text of the match. */
  readonly lexeme: string;
  /** The rule that fired. */
  readonly type: MultiMatchType;
  /** The rule-specific metadata. */
  readonly meta: TMeta;
  /** Capture groups from the underlying pattern (group 0 is the lexeme). */
  readonly groups: readonly (string | undefined)[];
}

/**
 * A finalised, frozen set of N rules combined into one alternation regex.
 *
 * Construction: addRule(...) N times, then `compile()`. Once compiled,
 * call `match(input, fromIndex)` to find the next match anywhere at or
 * after `fromIndex`. Returns `null` if no rule matches.
 */
export class MultiRegex<TMeta> {
  // Per-rule metadata in order of registration.
  private readonly rules: MultiRule<TMeta>[] = [];
  // Maps the offset of the rule's first capture group within the union match
  // array to the rule's index in `rules`.
  private readonly matchAtToRuleIdx = new Map<number, number>();
  private compiledRe: RegExp | undefined;
  private nextMatchAt = 1;

  constructor(private readonly caseInsensitive: boolean) {}

  /**
   * Register a rule. The pattern is wrapped in its own non-capturing scope
   * during compile, so internal capture groups remain addressable but the
   * union itself uses a sentinel capture group per rule for branch tracking.
   *
   * Spec §12: builders may improve performance; the algorithmic surface
   * matches upstream's MultiRegex.addRule.
   */
  addRule(rule: MultiRule<TMeta>): void {
    this.rules.push(rule);
    // The first capture group for this rule is at position `nextMatchAt`.
    this.matchAtToRuleIdx.set(this.nextMatchAt, this.rules.length - 1);
    // Reserve room: 1 sentinel group + the rule's own internal groups.
    this.nextMatchAt += countMatchGroups(rule.pattern) + 1;
  }

  /** True if no rules have been registered. */
  get isEmpty(): boolean {
    return this.rules.length === 0;
  }

  /**
   * Compile the rules into one regex. Must be called once before any
   * `match`. Calling twice replaces the previous compilation.
   */
  compile(): void {
    if (this.rules.length === 0) {
      // No rules — we will never find a match. Use a regex that matches nothing.
      this.compiledRe = /(?!)/g;
      return;
    }
    // Wrap each rule's pattern in its own capture group; backreferences inside
    // a single rule's pattern point to its own internal groups. Intra-rule
    // backreferences are unaffected by the leading wrapper because there is
    // no other rule between the wrapper and the reference target. Inter-rule
    // backrefs are not supported in v0 — flagged in build-manifest-c3a.md.
    const union = this.rules.map((r) => `(${r.pattern})`).join('|');
    const flags = this.caseInsensitive ? 'gmi' : 'gm';
    this.compiledRe = new RegExp(union, flags);
  }

  /**
   * Find the next match at or after `fromIndex`. Returns null if no rule
   * fires. The returned result includes which rule type fired and the
   * meta payload registered with that rule.
   */
  match(input: string, fromIndex: number): MultiMatchResult<TMeta> | null {
    const re = this.compiledRe;
    if (re === undefined) {
      throw new Error('MultiRegex.match called before compile()');
    }
    if (this.rules.length === 0) return null;
    re.lastIndex = fromIndex;
    const m = re.exec(input);
    if (m === null) return null;
    // Find which rule's sentinel group fired by scanning capture groups.
    let firedRuleIdx = -1;
    let firedAt = -1;
    for (let i = 1; i < m.length; i++) {
      if (m[i] !== undefined) {
        const ruleIdx = this.matchAtToRuleIdx.get(i);
        if (ruleIdx !== undefined) {
          firedRuleIdx = ruleIdx;
          firedAt = i;
          break;
        }
      }
    }
    if (firedRuleIdx < 0) return null;
    const rule = this.rules[firedRuleIdx];
    if (rule === undefined) return null;
    // Extract capture groups for this rule:
    //   m[firedAt] is group 0 of the rule (== lexeme)
    //   m[firedAt + 1 .. firedAt + internalGroupCount] are the rule's internal groups.
    const internalGroupCount = countMatchGroups(rule.pattern);
    const groups: (string | undefined)[] = [];
    for (let g = 0; g <= internalGroupCount; g++) {
      groups.push(m[firedAt + g]);
    }
    return {
      index: m.index,
      lexeme: m[0],
      type: rule.type,
      meta: rule.meta,
      groups,
    };
  }
}
