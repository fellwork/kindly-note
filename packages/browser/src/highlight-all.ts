// `highlightAll(hl, options?)` — highlight every matching DOM node.
//
// spec §1.2 row `@kindly-note/browser`: this is one of three exports.
// spec §7.1.1: migration target for upstream's `hljs.highlightAll()`.
// Scout §11: the upstream behaviour scans `document.querySelectorAll('pre code')`
// (or whatever `options.cssSelector` was last `configure()`'d to). We honor
// the highlighter's `options.cssSelector` as the default and accept an
// optional `selector` override + `root` for scoped queries.
//
// Implementation reference (NOT byte-copied): upstream's `highlightAll` at
// `src/highlight.js:828-846`. The DOMContentLoaded boot dance is omitted —
// we expect callers to invoke this once the DOM is ready (most modern apps
// do this from a module body that runs after parse). If a caller needs the
// upstream "delay until DOMContentLoaded" behaviour, they call
// `attachToDOM` instead, which handles both the initial scan AND the
// MutationObserver-based dynamic case.

import type { Highlighter } from '@kindly-note/core';

import type { HighlightElementOptions } from './highlight-element.js';
import { highlightElement } from './highlight-element.js';

/**
 * Options for `highlightAll`. Inherits per-element options
 * (`language`, `autoDetect`, `autoDetector`) which are forwarded to
 * every `highlightElement` call.
 */
export interface HighlightAllOptions extends HighlightElementOptions {
  /**
   * CSS selector to match. Default: `hl.options.cssSelector`, which itself
   * defaults to `'pre code'` (upstream parity, spec §7.3 capability table).
   */
  readonly selector?: string;
  /**
   * Optional root to query against. Default: `document`. Useful for
   * scoping to a Shadow DOM root or a server-rendered content island.
   */
  readonly root?: ParentNode;
}

/**
 * Highlight every element matching `options.selector` (default
 * `hl.options.cssSelector`, which is `'pre code'`) under
 * `options.root` (default `document`). spec §7.1.1.
 *
 * Each element passes through `highlightElement` independently — per-element
 * errors do NOT abort the batch (the engine's safe-mode error isolation
 * applies — spec §2.4). Elements already carrying the
 * `dataset.highlighted` marker are skipped (idempotence — see
 * `highlightElement`).
 *
 * In environments without a `document` global (Node, Workers, Edge), this
 * function is a no-op when `options.root` is also undefined. That choice
 * lets a server-side renderer import the package without crashing — a
 * runtime check beats a `typeof window` guard at the call site.
 */
export function highlightAll(hl: Highlighter, options: HighlightAllOptions = {}): void {
  const root = options.root ?? defaultRoot();
  if (root === undefined) return;

  const selector = options.selector ?? hl.options.cssSelector;
  // querySelectorAll returns a NodeList of all matching elements at the
  // time of call. We snapshot via Array.from so subsequent mutations to
  // the DOM (a plugin's afterElement that adds new <pre><code> blocks)
  // do not perturb our iteration order.
  const nodes = Array.from(root.querySelectorAll(selector)) as Element[];

  // Forward per-element options to every call. This keeps
  // `highlightElement(el, hl, { autoDetect, autoDetector })` semantics
  // identical between the singular and plural entry points.
  const perElement: HighlightElementOptions = {};
  if (options.language !== undefined) {
    Object.assign(perElement, { language: options.language });
  }
  if (options.autoDetect !== undefined) {
    Object.assign(perElement, { autoDetect: options.autoDetect });
  }
  if (options.autoDetector !== undefined) {
    Object.assign(perElement, { autoDetector: options.autoDetector });
  }

  for (const el of nodes) {
    highlightElement(el, hl, perElement);
  }
}

/**
 * Resolve the default root. We prefer `globalThis.document` (the
 * browser/jsdom case); when it is missing (Node, Workers, Edge) we return
 * `undefined` to signal "no DOM here, no-op". This avoids the upstream
 * pattern of throwing `ReferenceError: document is not defined` at
 * import time.
 */
function defaultRoot(): ParentNode | undefined {
  const g = globalThis as unknown as { document?: ParentNode };
  return g.document;
}
