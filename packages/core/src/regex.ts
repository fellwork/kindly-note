// Typed regex composition helpers — published as the `@kindly-note/core/regex` subpath.
// spec section 7.3 (regex utilities); spec section 8.1 (Cat 1 - language packages may
// import this directly when factory-arg routing is impractical, e.g. F# uses regex at
// module-init time).
//
// These are pure string-level helpers. They produce regex *source text*, not RegExp
// instances; the matcher compiles them to RegExp at compile-time.

export type RegexLike = string | RegExp;

/** Coerce a RegexLike to its source string. */
export function source(re: RegexLike | undefined | null): string {
  if (re === undefined || re === null) return '';
  if (typeof re === 'string') return re;
  return re.source;
}

/** Concatenate multiple regex fragments into one source string. */
export function concat(...args: readonly RegexLike[]): string {
  return args.map(source).join('');
}

/** Wrap a fragment in a positive lookahead. */
export function lookahead(re: RegexLike): string {
  return `(?=${source(re)})`;
}

/** Wrap a fragment in a Kleene-star non-capturing group. */
export function anyNumberOfTimes(re: RegexLike): string {
  return `(?:${source(re)})*`;
}

/** Wrap a fragment so it matches zero or one occurrence. */
export function optional(re: RegexLike): string {
  return `(?:${source(re)})?`;
}

/** Options for the alternation builder. */
export interface EitherOptions {
  /** When true, wraps the alternation in a capturing group instead of a non-capturing one. */
  readonly capture?: boolean;
}

/**
 * Build an alternation. Pass an EitherOptions object as the trailing argument to opt
 * into capturing semantics. Mirrors upstream regex.either(...args).
 */
export function either(...args: readonly (RegexLike | EitherOptions)[]): string {
  let opts: EitherOptions = {};
  let parts: readonly RegexLike[] = args as readonly RegexLike[];
  const last = args[args.length - 1];
  if (
    last !== undefined &&
    typeof last === 'object' &&
    !(last instanceof RegExp) &&
    Object.getPrototypeOf(last) === Object.prototype
  ) {
    opts = last as EitherOptions;
    parts = args.slice(0, -1) as readonly RegexLike[];
  }
  const open = opts.capture === true ? '(' : '(?:';
  const inner = parts.map(source).join('|');
  return `${open}${inner})`;
}

/**
 * Escape a literal string so it can be used as a regex fragment. Mirrors the
 * upstream name `escape`, exported as a regex-namespace member; the global
 * `window.escape` is unrelated.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: spec §7.3 capability table preserves the name
export function escape(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/** Count the number of capture groups in a regex fragment. */
export function countMatchGroups(re: RegexLike): number {
  // Probe trick: alternating with empty always matches; exec() length tells us groups.
  const probe = new RegExp(`${source(re)}|`);
  const match = probe.exec('');
  return match === null ? 0 : match.length - 1;
}

/**
 * Test whether a regex matches at the very start of lexeme.
 * Returns true on a zero-index match; otherwise false.
 */
export function startsWith(re: RegExp, lexeme: string): boolean {
  const match = re.exec(lexeme);
  return match !== null && match.index === 0;
}
