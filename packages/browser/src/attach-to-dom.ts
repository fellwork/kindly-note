// `attachToDOM(hl, options?)` — eager scan + observe for new code blocks.
//
// spec §1.2 row `@kindly-note/browser`: this is the third of three exports.
// spec §7.1.1 example: `attachToDOM(hl, { selector: 'pre code' })` is the
// modern equivalent of `hljs.highlightAll()`. Unlike `highlightAll` (which
// is a one-shot scan), `attachToDOM` ALSO sets up a `MutationObserver` so
// dynamically-added content (a virtual-DOM mount, a Markdown render that
// runs after initial layout) is highlighted automatically.
//
// The dispose handle is the explicit teardown path — callers that mount
// kindly-note in a SPA route should `.dispose()` on unmount to avoid
// leaking observers across navigations.

import type { Highlighter } from '@kindly-note/core';

import type { HighlightAllOptions } from './highlight-all.js';
import { highlightAll } from './highlight-all.js';
import { highlightElement } from './highlight-element.js';

/**
 * Options for `attachToDOM`. Inherits `selector`, `root`, `language`,
 * `autoDetect`, `autoDetector` from `HighlightAllOptions`.
 */
export interface AttachToDOMOptions extends HighlightAllOptions {
  /**
   * Watch for newly added matching nodes via `MutationObserver`. Default:
   * `true`. Set to `false` for a one-shot scan equivalent to
   * `highlightAll`. spec §1.2 row.
   */
  readonly observeMutations?: boolean;
}

/**
 * Handle returned by `attachToDOM`. Call `dispose()` to disconnect the
 * `MutationObserver` (if one was installed). After disposal, freshly
 * added nodes are NOT highlighted; existing nodes keep their highlighted
 * state (the function does not un-highlight anything).
 */
export interface AttachedHandle {
  /** Stop observing and clean up. */
  dispose(): void;
}

/**
 * Eagerly highlight all matching nodes under `options.root` (default
 * `document`), then (when `observeMutations !== false`) install a
 * `MutationObserver` so future matching nodes are highlighted as they
 * appear. spec §7.1.1.
 *
 * The observer watches for additions (`childList: true, subtree: true`)
 * and walks each newly-added subtree for matching elements. We do NOT
 * react to attribute changes — adding `class="language-foo"` to an
 * already-highlighted node will not re-highlight it (deliberate; the
 * idempotence guard in `highlightElement` blocks it anyway). To
 * re-highlight, the caller clears `dataset.highlighted` and re-invokes
 * `highlightElement(el, hl)`.
 */
export function attachToDOM(hl: Highlighter, options: AttachToDOMOptions = {}): AttachedHandle {
  const observeMutations = options.observeMutations !== false;
  const root = options.root ?? defaultRoot();
  if (root === undefined) {
    // No DOM available. Return an inert handle so callers can still
    // `dispose()` without a runtime check.
    return Object.freeze({ dispose() {} });
  }

  // 1. Initial scan.
  highlightAll(hl, options);

  // 2. Observer (optional).
  if (!observeMutations) {
    return Object.freeze({ dispose() {} });
  }

  const selector = options.selector ?? hl.options.cssSelector;

  // The observer needs a `Node` to observe. The shared root may be a
  // `Document`, an `Element`, a `DocumentFragment`, or a `ShadowRoot` —
  // all of which extend `Node`. We narrow defensively.
  const observable = root as unknown as Node;
  const ObserverCtor = readObserverCtor();
  if (ObserverCtor === undefined) {
    // Environment without a MutationObserver constructor (e.g. Node
    // without happy-dom/jsdom). The initial scan already happened; we
    // just return an inert handle.
    return Object.freeze({ dispose() {} });
  }

  // Forward per-element options to every dynamic call.
  const perElement = {
    ...(options.language !== undefined ? { language: options.language } : {}),
    ...(options.autoDetect !== undefined ? { autoDetect: options.autoDetect } : {}),
    ...(options.autoDetector !== undefined ? { autoDetector: options.autoDetector } : {}),
  };

  const observer = new ObserverCtor((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      // The added node may itself match, OR it may be a parent of
      // matching descendants (e.g. a virtual-DOM mount that adds a
      // whole subtree). We handle both cases.
      for (const node of Array.from(mutation.addedNodes)) {
        if (!isElement(node)) continue;
        if (node.matches(selector)) {
          highlightElement(node, hl, perElement);
        }
        for (const descendant of Array.from(node.querySelectorAll(selector)) as Element[]) {
          highlightElement(descendant, hl, perElement);
        }
      }
    }
  });

  observer.observe(observable, { childList: true, subtree: true });

  return Object.freeze({
    dispose() {
      observer.disconnect();
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the default root (browser-only convenience). */
function defaultRoot(): ParentNode | undefined {
  const g = globalThis as unknown as { document?: ParentNode };
  return g.document;
}

/**
 * Read the `MutationObserver` constructor from the runtime. We do not
 * import any DOM identifier directly because that would couple the
 * package's import-time evaluation to the presence of the DOM. Reading
 * via `globalThis` lets the package evaluate cleanly in non-DOM runtimes
 * (Workers, server renderers).
 */
function readObserverCtor():
  | (new (
      cb: (mutations: MutationRecord[]) => void,
    ) => MutationObserver)
  | undefined {
  const g = globalThis as unknown as { MutationObserver?: new (...args: unknown[]) => unknown };
  return g.MutationObserver as
    | (new (
        cb: (mutations: MutationRecord[]) => void,
      ) => MutationObserver)
    | undefined;
}

/** Type-narrowing helper: is this node an `Element`? */
function isElement(node: Node): node is Element {
  // Node.ELEMENT_NODE = 1; we test by numeric value to avoid relying on
  // the global `Node` constant (which is missing in strict TS contexts
  // when lib.dom is partially shimmed).
  return node.nodeType === 1;
}
