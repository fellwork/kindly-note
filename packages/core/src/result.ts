// Result and input types for the highlight pipeline.
// spec §2.2 (CodeInput, HighlightResult); spec §5.7 (engine wires _tokenStream).
import type { TokenStream } from './emitter.js';

/**
 * Input to a single highlight call. Pure value — plugins return new instances rather
 * than mutating the caller's input. spec §2.2.
 */
export interface CodeInput {
  readonly code: string;
  readonly language: string;
  readonly ignoreIllegals: boolean;
}

/**
 * The public, frozen result of a highlight call. The engine internally attaches a
 * private `_tokenStream` for sub-language insertion (spec §5.7); plugin authors and
 * end-users see only the public fields.
 */
export interface HighlightResult {
  /** Rendered output (string for the HTML emitter, hast for the hast emitter, etc.). */
  readonly value: string;
  /** Canonical language name (not an alias), or undefined for unknown-language fallback. */
  readonly language?: string;
  /** Relevance score; used by auto-detect tie-breaking. */
  readonly relevance: number;
  /** True if the parser hit an `illegal` rule and bailed out. */
  readonly illegal: boolean;
  /** Optional: original input code, retained for debug. */
  readonly code?: string;
  /** Auto-detect runner-up. spec §7.3 (capability migration table). */
  readonly secondBest?: HighlightResult;
  /**
   * Internal-only: the typed token stream for sub-language insertion. Public API
   * does NOT depend on this (spec §5.2, §5.7). Plugin authors must not read it;
   * if they do, they're holding an undocumented surface.
   */
  readonly _tokenStream?: TokenStream;
}

/** Options that go alongside `code` into highlight(). spec §7.3. */
export interface HighlightOptions {
  readonly language: string;
  readonly ignoreIllegals?: boolean;
}

/** DOM-element pre-hook input. spec §2.2. */
export interface ElementInput {
  readonly el: unknown;
  readonly language: string;
}

/** DOM-element post-hook input. spec §2.2. */
export interface ElementOutput {
  readonly el: unknown;
  readonly result: HighlightResult;
  readonly text: string;
}
