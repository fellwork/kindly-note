// Legacy HLJSPlugin shape — verbatim mirror of upstream
// `highlight.js@11`'s `types/index.d.ts:126-134` (Scout §2 quote-cited).
//
// spec §3.2 normative: `LegacyHLJSPlugin` is what `adaptLegacyPlugin` accepts.
// The six hooks are all optional. The `*:highlightBlock` pair is upstream-
// deprecated since 10.7 (scheduled for removal in highlight.js v12); we keep
// it here so existing community plugins can be passed verbatim.

import type { HighlightResult } from '@kindly-note/core';

/**
 * The mutable context passed to upstream `before:highlight` plugins. The
 * plugin may mutate `code`, `language`, or set `result` to short-circuit the
 * pipeline. Scout §2 (fire site `src/highlight.js:157-169`).
 */
export interface LegacyBeforeHighlightContext {
  code: string;
  language: string;
  result?: HighlightResult;
}

/**
 * The mutable element pre-hook arg. spec §3.3 row 3.
 *
 * Upstream uses `HTMLElement` for `el`; we accept the broader `Element` so
 * non-browser DOMs (e.g. linkedom, jsdom) can pass through. The adapter never
 * touches `el`'s DOM properties at runtime — the field is by-reference
 * passthrough only.
 */
export interface LegacyBeforeHighlightElementData {
  el: Element;
  language: string;
}

/** spec §3.3 row 4. */
export interface LegacyAfterHighlightElementData {
  el: Element;
  result: HighlightResult;
  text: string;
}

/** spec §3.3 row 5 (deprecated upstream). */
export interface LegacyBeforeHighlightBlockData {
  block: Element;
  language: string;
}

/** spec §3.3 row 6 (deprecated upstream). */
export interface LegacyAfterHighlightBlockData {
  block: Element;
  result: HighlightResult;
  text: string;
}

/**
 * The legacy upstream plugin shape. spec §3.2 (and Scout §2 verbatim from
 * `highlight.js@11` `types/index.d.ts:126-134`).
 *
 * All six hooks are optional. Each hook receives a single mutable arg object
 * whose mutations the upstream `fire()` mechanism propagates back to the
 * caller. The adapter (spec §3.4) reproduces those mutation semantics inside
 * a quarantined boundary; the modern protocol (§2) sees only pure transforms.
 */
export interface LegacyHLJSPlugin {
  'before:highlight'?(context: LegacyBeforeHighlightContext): void;
  'after:highlight'?(result: HighlightResult): void;
  'before:highlightElement'?(args: LegacyBeforeHighlightElementData): void;
  'after:highlightElement'?(args: LegacyAfterHighlightElementData): void;
  /** Deprecated upstream — scheduled for removal in highlight.js v12. */
  'before:highlightBlock'?(args: LegacyBeforeHighlightBlockData): void;
  /** Deprecated upstream — scheduled for removal in highlight.js v12. */
  'after:highlightBlock'?(args: LegacyAfterHighlightBlockData): void;
}
